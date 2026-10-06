import { useQuery } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { simularMovimentoReduzido } from "../../teste/movimento";
import { adiado, notaDeTeste, simularFetch } from "../../teste/notas";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { GavetaDaNota } from "./GavetaDaNota";

const GET_NOTA = "GET /api/notas/1-1";
const POST = "POST /api/notas/1-1/pagamentos";

const parcial = () =>
  notaDeTeste({
    versao: 5,
    total_pago: "40.00",
    saldo: "120.00",
    pagamentos: [
      {
        id: 9,
        valor: "40.00",
        forma: "PIX",
        forma_rotulo: "Pix",
        recebido_em: "2026-10-01T12:00:00-03:00",
        recebido_por: "Bel",
        recibo_url: "/recibos/9/",
      },
    ],
  });

const recebido = () => responder({ recibo_url: "/recibos/9/", nota: parcial() });

/** Abre a gaveta da nota 01-01 e clica em Receber. */
async function abrirReceber(rotas: (chave: string) => unknown, dados = () => notaDeTeste()) {
  const api = simularFetch((chave) => rotas(chave) ?? (chave === GET_NOTA ? responder(dados()) : undefined));
  renderizarComApp(<GavetaDaNota />, { rota: "/?nota=01-01" });
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole("button", { name: "Receber" }));
  return { api, usuario };
}

const formulario = () => screen.queryByRole("form", { name: "Receber pagamento" });
const valor = () => screen.getByLabelText("Valor");
const confirmar = () => screen.getByRole("button", { name: "Confirmar pagamento" });
const saldo = () => screen.getByText("Saldo").closest("div") as HTMLElement;

async function digitarValor(usuario: ReturnType<typeof userEvent.setup>, texto: string) {
  await usuario.clear(valor());
  await usuario.type(valor(), texto);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Receber", () => {
  it("abre com o valor igual ao saldo, a forma Dinheiro e o foco no valor, no lugar das ações da nota", async () => {
    await abrirReceber(
      () => undefined,
      () => notaDeTeste({ total: "1234.50", saldo: "1234.50" }),
    );
    expect(formulario()).toBeInTheDocument();
    expect(valor()).toHaveValue("1.234,50");
    expect(valor()).toHaveFocus();
    expect(screen.getByLabelText("Forma")).toHaveValue("DINHEIRO");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Dinheiro", "Pix", "Cartão"]);
    expect(screen.queryByRole("button", { name: "Receber" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Correção" })).not.toBeInTheDocument();
  });

  it("confirmar sem mexer no valor envia o saldo inteiro", async () => {
    const { api, usuario } = await abrirReceber(
      (chave) => (chave === POST ? recebido() : undefined),
      () => notaDeTeste({ total: "1234.50", saldo: "1234.50" }),
    );
    vi.spyOn(window, "open").mockReturnValue(null);
    await usuario.click(confirmar());
    await waitFor(() => expect(formulario()).not.toBeInTheDocument());
    expect(api.corpoDe(POST)).toEqual({ versao: 4, valor: "1234.50", forma: "DINHEIRO" });
  });

  it('"40,00" envia "40.00" com a forma escolhida; em sucesso grava a nota, fecha o formulário e abre o recibo', async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const { api, usuario } = await abrirReceber((chave) => (chave === POST ? recebido() : undefined));
    await digitarValor(usuario, "40,00");
    await usuario.selectOptions(screen.getByLabelText("Forma"), "Pix");
    await usuario.click(confirmar());
    await waitFor(() => expect(abrirJanela).toHaveBeenCalledWith("/recibos/9/", "_blank", "noopener"));
    expect(abrirJanela).toHaveBeenCalledTimes(1);
    expect(api.corpoDe(POST)).toEqual({ versao: 4, valor: "40.00", forma: "PIX" });
    await waitFor(() => expect(formulario()).not.toBeInTheDocument());
    await waitFor(() => expect(saldo()).toHaveTextContent("R$ 120,00"), { timeout: 4000 });
    expect(screen.getByRole("link", { name: "Recibo" })).toHaveAttribute("href", "/recibos/9/");
    expect(screen.getByRole("button", { name: "Receber" })).toBeEnabled();
    expect(api.quantas(GET_NOTA)).toBe(1);
  });

  it("dois cliques rápidos em confirmar geram uma requisição só, com tudo travado até a resposta", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const espera = adiado();
    const { api } = await abrirReceber((chave) => (chave === POST ? espera.promessa.then(recebido) : undefined));
    fireEvent.click(confirmar());
    fireEvent.click(confirmar());
    fireEvent.submit(formulario() as HTMLElement);
    expect(confirmar()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    espera.liberar();
    await waitFor(() => expect(formulario()).not.toBeInTheDocument());
    expect(api.quantas(POST)).toBe(1);
  });

  it("valor inválido marca o campo e não envia", async () => {
    const { api, usuario } = await abrirReceber(() => undefined);
    await digitarValor(usuario, "quarenta");
    await usuario.click(confirmar());
    expect(valor()).toBeInvalid();
    expect(valor()).toHaveAccessibleDescription("Número inválido.");
    expect(api.quantas(POST)).toBe(0);
    await usuario.type(valor(), "1");
    expect(valor()).not.toBeInvalid();
  });

  it("erro 400 aparece no formulário, que continua aberto com o que foi digitado", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const { api, usuario } = await abrirReceber((chave) =>
      chave === POST ? responder({ erro: "O valor é maior que o saldo da nota.", campos: {} }, 400) : undefined,
    );
    await digitarValor(usuario, "500,00");
    await usuario.click(confirmar());
    expect(await screen.findByRole("alert")).toHaveTextContent("O valor é maior que o saldo da nota.");
    expect(formulario()).toContainElement(screen.getByRole("alert"));
    expect(valor()).toHaveValue("500,00");
    expect(confirmar()).toBeEnabled();
    expect(abrirJanela).not.toHaveBeenCalled();
    expect(api.quantas(GET_NOTA)).toBe(1);
  });

  it("erro 400 no campo valor marca o campo com a mensagem do servidor", async () => {
    const { usuario } = await abrirReceber((chave) =>
      chave === POST
        ? responder({ erro: "Confira os campos destacados.", campos: { valor: "Informe um número válido." } }, 400)
        : undefined,
    );
    await usuario.click(confirmar());
    await waitFor(() => expect(valor()).toHaveAccessibleDescription("Informe um número válido."));
    expect(valor()).toBeInvalid();
  });

  it("409 recarrega a nota e fecha o formulário com o aviso na gaveta", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    let atual = notaDeTeste();
    const { api, usuario } = await abrirReceber(
      (chave) =>
        chave === POST ? responder({ erro: "A nota mudou em outra tela. Confira e tente de novo." }, 409) : undefined,
      () => atual,
    );
    atual = parcial();
    await usuario.click(confirmar());
    expect(await screen.findByRole("alert")).toHaveTextContent("A nota mudou em outra tela. Confira e tente de novo.");
    expect(formulario()).not.toBeInTheDocument();
    await waitFor(() => expect(saldo()).toHaveTextContent("R$ 120,00"), { timeout: 4000 });
    expect(api.quantas(GET_NOTA)).toBe(2);
    expect(abrirJanela).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Nota 01-01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Receber" })).toBeInTheDocument();
  });

  it("Cancelar fecha o formulário sem enviar e devolve as ações da nota", async () => {
    const { api, usuario } = await abrirReceber(() => undefined);
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(formulario()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Receber" })).toBeInTheDocument();
    expect(api.chamadas()).toEqual([GET_NOTA]);
  });

  it("o recibo abre sem esperar as listas recarregarem", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    let buscasDoPainel = 0;
    simularFetch((chave) => {
      if (chave === GET_NOTA) return responder(notaDeTeste());
      if (chave === POST) return recebido();
      // A primeira carga do painel responde; a recarga pedida pela mutação nunca termina.
      if (chave === "GET /api/painel") return buscasDoPainel++ === 0 ? responder({}) : new Promise(() => {});
      return undefined;
    });
    function Painel() {
      const painel = useQuery({ queryKey: ["painel"], queryFn: () => fetch("/api/painel", { method: "GET" }) });
      return painel.isSuccess ? <p>painel carregado</p> : null;
    }
    renderizarComApp(
      <>
        <Painel />
        <GavetaDaNota />
      </>,
      { rota: "/?nota=01-01" },
    );
    const usuario = userEvent.setup();
    await screen.findByText("painel carregado");
    await usuario.click(await screen.findByRole("button", { name: "Receber" }));
    await usuario.click(confirmar());
    await waitFor(() => expect(abrirJanela).toHaveBeenCalledWith("/recibos/9/", "_blank", "noopener"));
    expect(buscasDoPainel).toBe(2);
    expect(await screen.findByRole("button", { name: "Receber" })).toBeEnabled();
  });

  it("com movimento reduzido, o formulário aparece no lugar, sem subir nem esmaecer", async () => {
    const desfazer = simularMovimentoReduzido();
    try {
      await abrirReceber(() => undefined);
      const form = formulario() as HTMLElement;
      await waitFor(() => {
        expect(form).toHaveStyle({ opacity: "1" });
        expect(form.style.transform).not.toMatch(/translate/);
      });
    } finally {
      desfazer();
    }
  });
});
