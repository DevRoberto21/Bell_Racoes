import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LinhaNovoItem } from "./LinhaNovoItem";

function montar(aoAdicionar = vi.fn(async () => {})) {
  render(<LinhaNovoItem aoAdicionar={aoAdicionar} />);
  return { usuario: userEvent.setup(), aoAdicionar };
}

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
});
