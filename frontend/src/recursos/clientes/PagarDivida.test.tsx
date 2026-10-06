import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClienteDetalhe, NotaResumo, PreviaDivida } from "../../api/tipos";
import { adiado, simularFetch } from "../../teste/notas";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { PagarDivida } from "./PagarDivida";
import { TelaCliente } from "./TelaCliente";

const GET_CLIENTE = "GET /api/clientes/12";
const POST = "POST /api/clientes/12/pagamentos";
const PREVIA = "GET /api/clientes/12/divida/previa?valor=";
const CONFLITO = "A dívida deste cliente mudou no outro caixa. A tela foi atualizada; confira e repita.";

function nota(codigo: string, saldo: string): NotaResumo {
  return {
    codigo,
    cliente: { codigo: 12, codigo_formatado: "12", nome: "José Pereira" },
    numero: Number(codigo.split("-")[1]),
    tipo: "UNICA",
    tipo_rotulo: "Única",
    situacao: "FECHADA",
    situacao_rotulo: "Fechada",
    criada_em: "2026-09-10T10:00:00Z",
    quitada_em: null,
    editada: false,
    dias_em_aberto: 14,
    nivel_alerta: 2,
    total: saldo,
    saldo,
    imprimir_url: "/notas/12-1/imprimir/",
  };
}

function cliente(extra: Partial<ClienteDetalhe> = {}): ClienteDetalhe {
  return {
    codigo: 12,
    codigo_formatado: "12",
    nome: "José Pereira",
    apelido: "",
    telefone: "",
    divida: "241.10",
    notas_abertas: 2,
    notas: [nota("12-01", "144.70"), nota("12-03", "96.40")],
    tem_continua_aberta: false,
    pode_excluir: false,
    ...extra,
  };
}

/** Respostas da prévia por valor consultado. */
const PREVIAS: Record<string, PreviaDivida> = {
  "241.10": {
    divida: "241.10",
    sobra: "0.00",
    partes: [
      { codigo: "12-01", saldo: "144.70", parte: "144.70" },
      { codigo: "12-03", saldo: "96.40", parte: "96.40" },
    ],
  },
  "100.00": { divida: "241.10", sobra: "0.00", partes: [{ codigo: "12-01", saldo: "144.70", parte: "100.00" }] },
  "300.00": {
    divida: "241.10",
    sobra: "58.90",
    partes: [
      { codigo: "12-01", saldo: "144.70", parte: "144.70" },
      { codigo: "12-03", saldo: "96.40", parte: "96.40" },
    ],
  },
  "187.00": { divida: "187.00", sobra: "0.00", partes: [{ codigo: "12-03", saldo: "187.00", parte: "187.00" }] },
};

function previa(chave: string) {
  if (!chave.startsWith(PREVIA)) return undefined;
  const dados = PREVIAS[chave.slice(PREVIA.length)];
  return dados ? responder(dados) : undefined;
}

/** Abre a tela do cliente 12 e clica em "Pagar dívida total". */
async function abrirDialogo(rotas: (chave: string) => unknown = () => undefined, dados = () => cliente()) {
  const api = simularFetch(
    (chave) => rotas(chave) ?? previa(chave) ?? (chave === GET_CLIENTE ? responder(dados()) : undefined),
  );
  renderizarComApp(
    <Routes>
      <Route path="/clientes/:codigo" element={<TelaCliente />} />
    </Routes>,
    { rota: "/clientes/12" },
  );
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole("button", { name: "Pagar dívida total" }));
  return { api, usuario };
}

const dialogo = () => screen.queryByRole("dialog", { name: "Pagar dívida total" });
const valor = () => screen.getByLabelText("Valor");
const confirmar = () => screen.getByRole("button", { name: "Confirmar pagamento" });
const linha = (codigo: string) => screen.findByRole("row", { name: new RegExp(codigo) }, { timeout: 4000 });
const dividaNoDialogo = () => within(dialogo() as HTMLElement).getByText("Dívida").closest("p") as HTMLElement;

async function digitarValor(usuario: ReturnType<typeof userEvent.setup>, texto: string) {
  await usuario.clear(valor());
  await usuario.type(valor(), texto);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PagarDivida", () => {
  it("abre com o valor igual à dívida e a distribuição que o servidor devolve", async () => {
    const { api } = await abrirDialogo();
    expect(dialogo()).toBeInTheDocument();
    expect(valor()).toHaveValue("241,10");
    expect(valor()).toHaveFocus();
    expect(screen.getByLabelText("Forma")).toHaveValue("DINHEIRO");
    expect(dividaNoDialogo()).toHaveTextContent("R$ 241,10");
    expect(screen.getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Nota", "Saldo", "Abate"]);
    const primeira = await linha("12-01");
    expect(within(primeira).getAllByRole("cell").map((c) => c.textContent)).toEqual(["12-01", "R$ 144,70", "R$ 144,70"]);
    expect(await linha("12-03")).toHaveTextContent("R$ 96,40");
    expect(api.quantas(`${PREVIA}241.10`)).toBe(1);
    expect(confirmar()).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a prévia consulta com o valor convertido e só depois de 200 ms sem digitar", async () => {
    vi.useFakeTimers();
    const api = simularFetch(previa);
    const passar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
    renderizarComApp(<PagarDivida cliente={cliente()} aberto aoFechar={() => {}} />);
    await passar(0);
    expect(api.chamadas()).toEqual([`${PREVIA}241.10`]);

    fireEvent.change(valor(), { target: { value: "1" } });
    await passar(150);
    fireEvent.change(valor(), { target: { value: "10" } });
    await passar(150);
    fireEvent.change(valor(), { target: { value: "100,00" } });
    await passar(199);
    expect(api.chamadas()).toEqual([`${PREVIA}241.10`]);
    await passar(1);
    expect(api.chamadas()).toEqual([`${PREVIA}241.10`, `${PREVIA}100.00`]);
    await passar(50);
    expect(within(screen.getByRole("row", { name: /12-01/ })).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "12-01",
      "R$ 144,70",
      "R$ 100,00",
    ]);
    expect(screen.queryByRole("row", { name: /12-03/ })).not.toBeInTheDocument();
  });

  it("valor que não é número não consulta a prévia nem mostra a distribuição", async () => {
    vi.useFakeTimers();
    const api = simularFetch(previa);
    const passar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
    renderizarComApp(<PagarDivida cliente={cliente()} aberto aoFechar={() => {}} />);
    await passar(50);
    expect(screen.getByRole("row", { name: /12-01/ })).toBeInTheDocument();
    fireEvent.change(valor(), { target: { value: "cem" } });
    await passar(1000);
    expect(api.chamadas()).toEqual([`${PREVIA}241.10`]);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("com sobra diferente de 0.00 avisa que o valor é maior que a dívida e desabilita confirmar", async () => {
    const { api, usuario } = await abrirDialogo();
    await linha("12-01");
    await digitarValor(usuario, "300,00");
    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent(
      "O valor é maior que a dívida do cliente.",
    );
    expect(confirmar()).toBeDisabled();
    await digitarValor(usuario, "241,10");
    await waitFor(() => expect(confirmar()).toBeEnabled(), { timeout: 4000 });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.quantas(POST)).toBe(0);
  });

  it("envia valor, forma e divida_esperada; em sucesso fecha, atualiza o cliente com o devolvido e abre o recibo", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const depois = cliente({ divida: "141.10", notas_abertas: 1, notas: [nota("12-03", "141.10")] });
    const { api, usuario } = await abrirDialogo((chave) =>
      chave === POST ? responder({ recibo_url: "/recibos/lote/abc/", cliente: depois }) : undefined,
    );
    await digitarValor(usuario, "100,00");
    await usuario.selectOptions(screen.getByLabelText("Forma"), "Cartão");
    await usuario.click(confirmar());
    await waitFor(() => expect(abrirJanela).toHaveBeenCalledWith("/recibos/lote/abc/", "_blank", "noopener"));
    expect(abrirJanela).toHaveBeenCalledTimes(1);
    expect(api.corpoDe(POST)).toEqual({ valor: "100.00", forma: "CARTAO", divida_esperada: "241.10" });
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("button", { name: /12-01/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /12-03/ })).toHaveTextContent("R$ 141,10");
    expect(api.quantas(GET_CLIENTE)).toBe(1);
  });

  it("dois cliques rápidos em confirmar geram uma requisição só, e o diálogo não fecha até a resposta", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const espera = adiado();
    const { api } = await abrirDialogo((chave) =>
      chave === POST
        ? espera.promessa.then(() => responder({ recibo_url: "/recibos/lote/abc/", cliente: cliente({ divida: "0.00", notas: [] }) }))
        : undefined,
    );
    await linha("12-01");
    fireEvent.click(confirmar());
    fireEvent.click(confirmar());
    fireEvent.submit(valor().closest("form") as HTMLElement);
    expect(confirmar()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialogo()).toBeInTheDocument();
    espera.liberar();
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument());
    expect(api.quantas(POST)).toBe(1);
  });

  it("valor inválido marca o campo e não envia", async () => {
    const { api, usuario } = await abrirDialogo();
    await digitarValor(usuario, "cem");
    await usuario.click(confirmar());
    expect(valor()).toBeInvalid();
    expect(valor()).toHaveAccessibleDescription("Número inválido.");
    expect(api.quantas(POST)).toBe(0);
  });

  it("erro 400 aparece no diálogo, que continua aberto", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const { api, usuario } = await abrirDialogo((chave) =>
      chave === POST ? responder({ erro: "Informe um valor maior que zero.", campos: {} }, 400) : undefined,
    );
    await usuario.click(confirmar());
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe um valor maior que zero.");
    expect(dialogo()).toBeInTheDocument();
    expect(confirmar()).toBeEnabled();
    expect(abrirJanela).not.toHaveBeenCalled();
    expect(api.quantas(GET_CLIENTE)).toBe(1);
  });

  it("409 mostra a mensagem, recarrega o cliente e a prévia e mantém o diálogo aberto com a dívida nova", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    let atual = cliente();
    let envios = 0;
    const { api, usuario } = await abrirDialogo(
      (chave) => {
        if (chave !== POST) return undefined;
        return envios++ === 0
          ? responder({ erro: CONFLITO, campos: {} }, 409)
          : responder({ recibo_url: "/recibos/lote/abc/", cliente: cliente({ divida: "0.00", notas: [], notas_abertas: 0 }) });
      },
      () => atual,
    );
    await linha("12-01");
    atual = cliente({ divida: "187.00", notas_abertas: 1, notas: [nota("12-03", "187.00")] });
    await usuario.click(confirmar());
    expect(await screen.findByRole("alert")).toHaveTextContent(CONFLITO);
    expect(dialogo()).toBeInTheDocument();
    await waitFor(() => expect(valor()).toHaveValue("187,00"));
    expect(dividaNoDialogo()).toHaveTextContent("R$ 187,00");
    expect(api.quantas(GET_CLIENTE)).toBe(2);
    await waitFor(() => expect(api.quantas(`${PREVIA}187.00`)).toBe(1), { timeout: 4000 });
    expect(within(await linha("12-03")).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "12-03",
      "R$ 187,00",
      "R$ 187,00",
    ]);
    expect(screen.queryByRole("row", { name: /12-01/ })).not.toBeInTheDocument();
    expect(abrirJanela).not.toHaveBeenCalled();

    // Confirmar de novo já manda a dívida nova como esperada.
    await usuario.click(confirmar());
    await waitFor(() => expect(abrirJanela).toHaveBeenCalledWith("/recibos/lote/abc/", "_blank", "noopener"));
    const segundo = JSON.parse(
      vi.mocked(fetch).mock.calls.filter(([url, o]) => `${o?.method} ${url}` === POST)[1][1]!.body as string,
    );
    expect(segundo).toEqual({ valor: "187.00", forma: "DINHEIRO", divida_esperada: "187.00" });
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument());
  });

  it("Cancelar fecha sem enviar, e reabrir começa de novo pela dívida", async () => {
    const { api, usuario } = await abrirDialogo();
    await digitarValor(usuario, "100,00");
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(dialogo()).not.toBeInTheDocument();
    expect(api.quantas(POST)).toBe(0);
    await usuario.click(screen.getByRole("button", { name: "Pagar dívida total" }));
    expect(valor()).toHaveValue("241,10");
  });
});
