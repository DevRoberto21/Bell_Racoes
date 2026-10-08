import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClienteDetalhe, Nota, NotaResumo } from "../../api/tipos";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { TelaCliente } from "./TelaCliente";

function nota(codigo: string, extra: Partial<NotaResumo> = {}): NotaResumo {
  return {
    codigo,
    cliente: { codigo: 12, codigo_formatado: "12", nome: "José Pereira" },
    numero: Number(codigo.split("-")[1]),
    tipo: "UNICA",
    tipo_rotulo: "Única",
    situacao: "ABERTA",
    situacao_rotulo: "Aberta",
    criada_em: "2026-09-10T10:00:00Z",
    quitada_em: null,
    editada: false,
    dias_em_aberto: 14,
    nivel_alerta: 2,
    total: "100.00",
    saldo: "96.40",
    imprimir_url: "/notas/12-1/imprimir/",
    ...extra,
  };
}

function cliente(extra: Partial<ClienteDetalhe> = {}): ClienteDetalhe {
  return {
    codigo: 12,
    codigo_formatado: "12",
    nome: "José Pereira",
    apelido: "Zé",
    telefone: "(11)99999-0000",
    divida: "241.10",
    notas_abertas: 2,
    notas: [nota("12-01"), nota("12-03", { editada: true })],
    tem_continua_aberta: false,
    pode_excluir: false,
    ...extra,
  };
}

const continua = (extra: Partial<NotaResumo> = {}) => nota("12-02", { tipo: "CONTINUA", tipo_rotulo: "Contínua", ...extra });
const comContinua = () => cliente({ notas: [nota("12-01"), continua()], tem_continua_aberta: true });
const local = () => screen.getByTestId("local");

let fetchSimulado: ReturnType<typeof vi.fn>;

function simular(dados: ClienteDetalhe, extra: (chave: string) => unknown = () => undefined) {
  fetchSimulado = vi.fn(async (url: string, opcoes?: RequestInit) => {
    const chave = `${opcoes?.method ?? "GET"} ${url}`;
    const especial = extra(chave);
    if (especial !== undefined) return especial;
    if (chave === "GET /api/clientes/12") return responder(dados);
    throw new Error(`requisição inesperada: ${chave}`);
  });
  vi.stubGlobal("fetch", fetchSimulado);
}

function tela() {
  return renderizarComApp(
    <Routes>
      <Route path="/clientes" element={<p>Lista de clientes</p>} />
      <Route path="/clientes/:codigo" element={<TelaCliente />} />
    </Routes>,
    { rota: "/clientes/12" },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("TelaCliente", () => {
  it("mostra cabeçalho, telefone, dívida e as notas em aberto", async () => {
    simular(cliente());
    tela();
    expect(await screen.findByRole("heading", { name: "12 · José Pereira (Zé)" })).toBeInTheDocument();
    expect(screen.getByText("(11)99999-0000")).toBeInTheDocument();
    expect(screen.getByText("R$ 241,10")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notas em aberto" })).toBeInTheDocument();
    const editada = screen.getByRole("button", { name: /12-03/ });
    expect(editada).toHaveTextContent("Editado");
    expect(editada).toHaveTextContent("14 dias");
    expect(editada).toHaveTextContent("R$ 96,40");
    expect(screen.getByRole("button", { name: /12-01/ })).not.toHaveTextContent("Editado");
  });

  it("clicar numa nota abre a gaveta dela", async () => {
    simular(cliente());
    tela();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: /12-03/ }));
    expect(screen.getByTestId("local")).toHaveTextContent("/clientes/12?nota=12-03");
  });

  it("com contínua aberta, o botão vira Abrir nota contínua e abre a gaveta dela", async () => {
    simular(comContinua());
    tela();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Abrir nota contínua" }));
    expect(local()).toHaveTextContent("/clientes/12?nota=12-02");
    expect(screen.queryByRole("button", { name: "Nova nota contínua" })).not.toBeInTheDocument();
    expect(fetchSimulado.mock.calls.every(([, o]) => (o?.method ?? "GET") === "GET")).toBe(true);
  });

  it("C abre a contínua aberta, em maiúscula ou minúscula", async () => {
    simular(comContinua());
    tela();
    const usuario = userEvent.setup();
    await screen.findByRole("heading", { name: "Notas em aberto" });
    await usuario.keyboard("C");
    expect(local()).toHaveTextContent("/clientes/12?nota=12-02");
  });

  it("C não faz nada sem contínua aberta", async () => {
    simular(cliente({ notas: [nota("12-01"), continua({ situacao: "FECHADA", situacao_rotulo: "Fechada" })] }));
    tela();
    const usuario = userEvent.setup();
    await screen.findByRole("heading", { name: "Notas em aberto" });
    await usuario.keyboard("c");
    expect(local()).toHaveTextContent(/^\/clientes\/12$/);
    expect(screen.getByRole("button", { name: "Nova nota contínua" })).toBeEnabled();
  });

  it("C não faz nada com um diálogo aberto, nem com o foco num campo", async () => {
    simular(comContinua());
    tela();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Editar cadastro" }));
    const dialogo = await screen.findByRole("dialog", { name: "Editar cadastro" });
    await usuario.keyboard("c");
    expect(local()).toHaveTextContent(/^\/clientes\/12$/);
    await usuario.click(within(dialogo).getByLabelText("Nome"));
    await usuario.keyboard("c");
    expect(local()).toHaveTextContent(/^\/clientes\/12$/);
  });

  it("nova nota contínua fica habilitada quando não há contínua aberta", async () => {
    simular(cliente());
    tela();
    expect(await screen.findByRole("button", { name: "Nova nota contínua" })).toBeEnabled();
  });

  it("a frase do rascunho só aparece havendo rascunho na lista", async () => {
    simular(cliente({ notas: [nota("12-01"), nota("12-04", { situacao: "RASCUNHO", nivel_alerta: 0 })] }));
    const { unmount } = tela();
    expect(
      await screen.findByText("Rascunho ainda não é dívida: só entra na conta depois de finalizado."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /12-04/ })).toHaveTextContent("Rascunho");
    unmount();
    simular(cliente());
    tela();
    await screen.findByRole("heading", { name: "Notas em aberto" });
    expect(screen.queryByText(/Rascunho ainda não é dívida/)).not.toBeInTheDocument();
  });

  it("Pagar dívida total só aparece com dívida diferente de 0.00", async () => {
    simular(cliente({ divida: "0.00", notas: [], notas_abertas: 0 }));
    const { unmount } = tela();
    await screen.findByRole("heading", { name: "Notas em aberto" });
    expect(screen.queryByRole("button", { name: "Pagar dívida total" })).not.toBeInTheDocument();
    unmount();
    simular(cliente());
    tela();
    expect(await screen.findByRole("button", { name: "Pagar dívida total" })).toBeInTheDocument();
  });

  it("criar nota única chama a API e abre a gaveta da nota criada", async () => {
    const criada = { ...nota("12-05"), itens: [], pagamentos: [] } as unknown as Nota;
    simular(cliente(), (chave) => (chave === "POST /api/clientes/12/notas" ? responder(criada) : undefined));
    tela();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Nova nota única" }));
    const chamada = fetchSimulado.mock.calls.find(([, o]) => o?.method === "POST");
    expect(JSON.parse(chamada![1].body)).toEqual({ tipo: "UNICA" });
    expect(await screen.findByText("/clientes/12?nota=12-05", { selector: "output" })).toBeInTheDocument();
  });

  it("Editar cadastro abre o formulário preenchido e salva com PATCH", async () => {
    simular(cliente(), (chave) =>
      chave === "PATCH /api/clientes/12" ? responder(cliente({ nome: "José P." })) : undefined,
    );
    tela();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Editar cadastro" }));
    const nome = screen.getByLabelText("Nome");
    expect(nome).toHaveValue("José Pereira");
    await usuario.clear(nome);
    await usuario.type(nome, "José P.");
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));
    const chamada = fetchSimulado.mock.calls.find(([, o]) => o?.method === "PATCH");
    expect(JSON.parse(chamada![1].body)).toEqual({ nome: "José P.", apelido: "Zé", telefone: "(11)99999-0000" });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Excluir só aparece com pode_excluir e só chama DELETE depois da confirmação", async () => {
    simular(cliente(), undefined);
    const { unmount } = tela();
    await screen.findByRole("heading", { name: "Notas em aberto" });
    expect(screen.queryByRole("button", { name: "Excluir cliente" })).not.toBeInTheDocument();
    unmount();

    simular(cliente({ pode_excluir: true, notas: [], divida: "0.00" }), (chave) =>
      chave === "DELETE /api/clientes/12" ? responder({}) : undefined,
    );
    tela();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Excluir cliente" }));
    expect(screen.getByRole("dialog", { name: "Excluir cliente" })).toBeInTheDocument();
    expect(fetchSimulado.mock.calls.some(([, o]) => o?.method === "DELETE")).toBe(false);
    await usuario.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Lista de clientes")).toBeInTheDocument();
    expect(fetchSimulado.mock.calls.some(([, o]) => o?.method === "DELETE")).toBe(true);
  });

  it("dois cliques rápidos em Excluir mandam um único DELETE", async () => {
    let liberar: () => void = () => {};
    const pendente = new Promise<void>((resolve) => (liberar = resolve));
    simular(cliente({ pode_excluir: true, notas: [], divida: "0.00" }), (chave) =>
      chave === "DELETE /api/clientes/12" ? pendente.then(() => responder({})) : undefined,
    );
    tela();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Excluir cliente" }));
    const confirmar = screen.getByRole("button", { name: "Excluir" });
    await usuario.click(confirmar);
    await usuario.click(confirmar);
    liberar();
    expect(await screen.findByText("Lista de clientes")).toBeInTheDocument();
    expect(fetchSimulado.mock.calls.filter(([, o]) => o?.method === "DELETE")).toHaveLength(1);
  });

  it("depois do DELETE não busca o cliente excluído nem mostra 'não encontrado'", async () => {
    simular(cliente({ pode_excluir: true, notas: [], divida: "0.00" }), (chave) =>
      chave === "DELETE /api/clientes/12" ? responder({}) : undefined,
    );
    tela();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Excluir cliente" }));
    await usuario.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Lista de clientes")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const chamadas = fetchSimulado.mock.calls.map(([url, o]) => `${o?.method ?? "GET"} ${url}`);
    const depois = chamadas.slice(chamadas.indexOf("DELETE /api/clientes/12") + 1);
    expect(depois.filter((c) => c === "GET /api/clientes/12")).toHaveLength(0);
    expect(screen.queryByText("Cliente não encontrado.")).not.toBeInTheDocument();
  });

  it("cliente inexistente mostra a mensagem e um link para a lista", async () => {
    simular(cliente(), (chave) =>
      chave === "GET /api/clientes/12" ? responder({ erro: "Não encontrado." }, 404) : undefined,
    );
    tela();
    expect(await screen.findByText("Cliente não encontrado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para a lista de clientes" })).toHaveAttribute("href", "/clientes");
  });

  it("define o título da aba com o nome do cliente", async () => {
    simular(cliente());
    tela();
    await screen.findByRole("heading", { name: /José Pereira/ });
    expect(document.title).toBe("José Pereira · Bell Rações");
  });
});
