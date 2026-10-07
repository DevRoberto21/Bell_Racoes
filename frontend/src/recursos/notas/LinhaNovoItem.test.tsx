import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { LinhaNovoItem } from "./LinhaNovoItem";

function montar(aoAdicionar = vi.fn(async () => {}), sugestoes: string[] = []) {
  const consultas = vi.fn(async (_url: string) => responder({ sugestoes }));
  vi.stubGlobal("fetch", consultas);
  renderizarComApp(<LinhaNovoItem aoAdicionar={aoAdicionar} />);
  return { usuario: userEvent.setup(), aoAdicionar, consultas };
}

afterEach(() => vi.unstubAllGlobals());

const descricao = () => screen.getByLabelText("Descrição");
const quantidade = () => screen.getByLabelText("Quantidade");
const preco = () => screen.getByLabelText("Preço");

async function preencher(usuario: ReturnType<typeof userEvent.setup>, d: string, q: string, p: string) {
  if (d) await usuario.type(descricao(), d);
  await usuario.clear(quantidade());
  if (q) await usuario.type(quantidade(), q);
  if (p) await usuario.type(preco(), p);
}

describe("LinhaNovoItem", () => {
  it("começa com a quantidade 1 e os outros campos vazios", () => {
    montar();
    expect(descricao()).toHaveValue("");
    expect(quantidade()).toHaveValue("1");
    expect(preco()).toHaveValue("");
  });

  it('"2" e "50,00" enviam quantidade "2.000" e preço "50.00"', async () => {
    const { usuario, aoAdicionar } = montar();
    await preencher(usuario, " Milho ", "2", "50,00");
    await usuario.keyboard("{Enter}");
    expect(aoAdicionar).toHaveBeenCalledWith({ descricao: "Milho", quantidade: "2.000", preco_unitario: "50.00" });
  });

  it.each(["Descrição", "Quantidade", "Preço"])("Enter no campo %s envia", async (rotulo) => {
    const { usuario, aoAdicionar } = montar();
    await preencher(usuario, "Milho", "1,5", "1.234,5");
    await usuario.type(screen.getByLabelText(rotulo), "{Enter}");
    expect(aoAdicionar).toHaveBeenCalledWith({ descricao: "Milho", quantidade: "1.500", preco_unitario: "1234.50" });
  });

  it('preço "abc" marca o campo e não envia', async () => {
    const { usuario, aoAdicionar } = montar();
    await preencher(usuario, "Milho", "2", "abc");
    await usuario.keyboard("{Enter}");
    expect(aoAdicionar).not.toHaveBeenCalled();
    expect(preco()).toHaveAttribute("aria-invalid", "true");
    expect(preco()).toHaveAccessibleDescription("Número inválido.");
    expect(quantidade()).not.toHaveAttribute("aria-invalid");
  });

  it("quantidade inválida marca só a quantidade e não envia", async () => {
    const { usuario, aoAdicionar } = montar();
    await preencher(usuario, "Milho", "1,2345", "10");
    await usuario.keyboard("{Enter}");
    expect(aoAdicionar).not.toHaveBeenCalled();
    expect(quantidade()).toHaveAccessibleDescription("Número inválido.");
    expect(preco()).not.toHaveAttribute("aria-invalid");
  });

  it("sem descrição não envia", async () => {
    const { usuario, aoAdicionar } = montar();
    await preencher(usuario, "", "1", "10");
    await usuario.keyboard("{Enter}");
    expect(aoAdicionar).not.toHaveBeenCalled();
    expect(descricao()).toHaveFocus();
  });

  it("depois do sucesso limpa, volta a quantidade para 1 e põe o foco na descrição", async () => {
    const { usuario } = montar();
    await preencher(usuario, "Milho", "2", "50,00");
    await usuario.keyboard("{Enter}");
    await waitFor(() => expect(descricao()).toHaveFocus());
    expect(descricao()).toHaveValue("");
    expect(quantidade()).toHaveValue("1");
    expect(preco()).toHaveValue("");
  });

  it("se o envio falhar mantém o que foi digitado", async () => {
    const { usuario } = montar(vi.fn(async () => Promise.reject(new Error("falhou"))));
    await preencher(usuario, "Milho", "2", "50,00");
    await usuario.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Adicionar" })).toBeEnabled());
    expect(descricao()).toHaveValue("Milho");
    expect(quantidade()).toHaveValue("2");
    expect(preco()).toHaveValue("50,00");
  });

  it("enquanto envia, um segundo Enter não manda de novo", async () => {
    let liberar: () => void = () => {};
    const aoAdicionar = vi.fn(() => new Promise<void>((resolve) => (liberar = resolve)));
    const { usuario } = montar(aoAdicionar);
    await preencher(usuario, "Milho", "2", "50,00");
    await usuario.keyboard("{Enter}");
    await usuario.keyboard("{Enter}");
    expect(aoAdicionar).toHaveBeenCalledTimes(1);
    liberar();
    await waitFor(() => expect(descricao()).toHaveValue(""));
  });

  it("corrigir o campo inválido tira a marca", async () => {
    const { usuario } = montar();
    await preencher(usuario, "Milho", "2", "abc");
    await usuario.keyboard("{Enter}");
    await usuario.clear(preco());
    await usuario.type(preco(), "5");
    expect(preco()).not.toHaveAttribute("aria-invalid");
  });

  describe("sugestões de descrição", () => {
    const RACOES = ["Ração cães 15kg", "Ração gatos"];
    const opcoes = () => screen.getAllByRole("option").map((o) => o.textContent);

    async function digitarComSugestoes(aoAdicionar = vi.fn(async () => {})) {
      const montado = montar(aoAdicionar, RACOES);
      await montado.usuario.type(preco(), "10");
      await montado.usuario.type(descricao(), "ra");
      await screen.findByRole("listbox");
      return montado;
    }

    it("duas letras consultam e mostram as descrições já usadas", async () => {
      const { consultas } = await digitarComSugestoes();
      expect(consultas).toHaveBeenCalledWith("/api/itens/sugestoes?q=ra", expect.anything());
      expect(opcoes()).toEqual(RACOES);
      expect(descricao()).toHaveAttribute("aria-expanded", "true");
    });

    it("uma letra só não consulta", async () => {
      const { usuario, consultas } = montar(undefined, RACOES);
      await usuario.type(descricao(), "r");
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(consultas).not.toHaveBeenCalled();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("seta para baixo e Enter aceitam a sugestão, sem enviar, e levam à quantidade", async () => {
      const { usuario, aoAdicionar } = await digitarComSugestoes();
      await usuario.keyboard("{ArrowDown}{ArrowDown}");
      expect(screen.getByRole("option", { name: "Ração gatos" })).toHaveAttribute("aria-selected", "true");
      await usuario.keyboard("{Enter}");
      expect(descricao()).toHaveValue("Ração gatos");
      expect(aoAdicionar).not.toHaveBeenCalled();
      expect(quantidade()).toHaveFocus();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("Tab aceita a sugestão destacada e segue para a quantidade", async () => {
      const { usuario } = await digitarComSugestoes();
      await usuario.keyboard("{ArrowDown}{Tab}");
      expect(descricao()).toHaveValue("Ração cães 15kg");
      expect(quantidade()).toHaveFocus();
    });

    it("Enter sem sugestão destacada envia o que foi digitado", async () => {
      const { usuario, aoAdicionar } = await digitarComSugestoes();
      await usuario.keyboard("{Enter}");
      expect(aoAdicionar).toHaveBeenCalledWith({ descricao: "ra", quantidade: "1.000", preco_unitario: "10.00" });
    });

    it("seta para cima a partir da primeira volta ao texto digitado", async () => {
      const { usuario, aoAdicionar } = await digitarComSugestoes();
      await usuario.keyboard("{ArrowDown}{ArrowUp}{Enter}");
      expect(aoAdicionar).toHaveBeenCalledWith({ descricao: "ra", quantidade: "1.000", preco_unitario: "10.00" });
    });

    it("Esc fecha a lista e não chega a quem está por fora", async () => {
      const porFora = vi.fn();
      document.addEventListener("keydown", porFora);
      const { usuario } = await digitarComSugestoes();
      porFora.mockClear();
      await usuario.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(porFora).not.toHaveBeenCalled();
      expect(descricao()).toHaveValue("ra");
      await usuario.keyboard("{Escape}");
      expect(porFora).toHaveBeenCalledTimes(1);
      document.removeEventListener("keydown", porFora);
    });

    it("clicar numa sugestão aceita e leva à quantidade", async () => {
      const { usuario, aoAdicionar } = await digitarComSugestoes();
      await usuario.click(screen.getByRole("option", { name: "Ração gatos" }));
      expect(descricao()).toHaveValue("Ração gatos");
      expect(quantidade()).toHaveFocus();
      expect(aoAdicionar).not.toHaveBeenCalled();
    });

    it("não sugere o que já está escrito igual", async () => {
      const { usuario } = montar(undefined, ["Milho", "Milho moído"]);
      await usuario.type(descricao(), "Milho");
      await screen.findByRole("listbox");
      expect(opcoes()).toEqual(["Milho moído"]);
    });

    it("se a consulta falhar o campo continua funcionando sem lista", async () => {
      const aoAdicionar = vi.fn(async () => {});
      vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("fora do ar"))));
      renderizarComApp(<LinhaNovoItem aoAdicionar={aoAdicionar} />);
      const usuario = userEvent.setup();
      await usuario.type(preco(), "10");
      await usuario.type(descricao(), "Milho");
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      await usuario.keyboard("{Enter}");
      expect(aoAdicionar).toHaveBeenCalledWith({ descricao: "Milho", quantidade: "1.000", preco_unitario: "10.00" });
    });
  });
});
