import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClienteDetalhe, ClienteLinha } from "../../api/tipos";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { TelaClientes } from "./TelaClientes";

const linhas: ClienteLinha[] = [
  { codigo: 12, codigo_formatado: "12", nome: "José Pereira", apelido: "Zé", telefone: "", divida: "241.10", notas_abertas: 2 },
  { codigo: 13, codigo_formatado: "13", nome: "Maria Souza", apelido: "", telefone: "", divida: "0.00", notas_abertas: 0 },
];

const novo: ClienteDetalhe = {
  ...linhas[0],
  codigo: 40,
  codigo_formatado: "40",
  nome: "Ana Lima",
  divida: "0.00",
  notas_abertas: 0,
  notas: [],
  tem_continua_aberta: false,
  pode_excluir: true,
};

let fetchSimulado: ReturnType<typeof vi.fn>;

function simular(extra: (chave: string) => unknown = () => undefined) {
  fetchSimulado = vi.fn(async (url: string, opcoes?: RequestInit) => {
    const chave = `${opcoes?.method ?? "GET"} ${url}`;
    const especial = extra(chave);
    if (especial !== undefined) return especial;
    if (chave.startsWith("GET /api/clientes?q=")) return responder(linhas);
    throw new Error(`requisição inesperada: ${chave}`);
  });
  vi.stubGlobal("fetch", fetchSimulado);
}

function tela() {
  return renderizarComApp(
    <Routes>
      <Route path="/clientes" element={<TelaClientes />} />
      <Route path="/clientes/:codigo" element={<p>Registro do cliente</p>} />
    </Routes>,
    { rota: "/clientes" },
  );
}

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TelaClientes", () => {
  it("define o título da aba", async () => {
    simular();
    tela();
    await screen.findByRole("heading", { name: "Clientes" });
    expect(document.title).toBe("Clientes · Bell Rações");
  });

  it("lista código, nome, apelido, notas abertas e dívida", async () => {
    simular();
    tela();
    expect(await screen.findByRole("heading", { name: "Clientes" })).toBeInTheDocument();
    const linha = await screen.findByRole("button", { name: /José Pereira/ });
    expect(linha).toHaveTextContent("12");
    expect(linha).toHaveTextContent("Zé");
    expect(linha).toHaveTextContent("2 notas");
    expect(linha).toHaveTextContent("R$ 241,10");
    expect(screen.getByRole("button", { name: /Maria Souza/ })).toHaveTextContent("R$ 0,00");
  });

  it("filtra pela API só depois de 150 ms de espera", async () => {
    simular();
    tela();
    await screen.findByRole("button", { name: /José Pereira/ });
    fireEvent.change(screen.getByLabelText("Filtrar por nome ou apelido"), { target: { value: "ze" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(fetchSimulado).not.toHaveBeenCalledWith("/api/clientes?q=ze", expect.anything());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledWith("/api/clientes?q=ze", expect.anything()));
  });

  it("clicar na linha leva ao registro do cliente", async () => {
    simular();
    tela();
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await usuario.click(await screen.findByRole("button", { name: /José Pereira/ }));
    expect(await screen.findByText("Registro do cliente")).toBeInTheDocument();
    expect(screen.getByTestId("local")).toHaveTextContent("/clientes/12");
  });

  it("Novo cliente abre o diálogo e, ao criar, vai para o cliente novo", async () => {
    simular((chave) => (chave === "POST /api/clientes" ? responder(novo) : undefined));
    tela();
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await usuario.click(await screen.findByRole("button", { name: "Novo cliente" }));
    expect(screen.getByRole("dialog", { name: "Novo cliente" })).toBeInTheDocument();
    await usuario.type(screen.getByLabelText("Nome"), "Ana Lima");
    await usuario.click(screen.getByRole("button", { name: "Criar cliente" }));
    expect(await screen.findByText("Registro do cliente")).toBeInTheDocument();
    expect(screen.getByTestId("local")).toHaveTextContent("/clientes/40");
    const chamada = fetchSimulado.mock.calls.find(([, o]) => o?.method === "POST");
    expect(JSON.parse(chamada![1].body)).toEqual({ nome: "Ana Lima", apelido: "", telefone: "" });
  });

  it("erro 400 do cadastro aparece junto ao campo e o diálogo continua aberto", async () => {
    simular((chave) =>
      chave === "POST /api/clientes"
        ? responder({ erro: "Confira os dados.", campos: { nome: "Preencha este campo." } }, 400)
        : undefined,
    );
    tela();
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await usuario.click(await screen.findByRole("button", { name: "Novo cliente" }));
    await usuario.click(screen.getByRole("button", { name: "Criar cliente" }));
    expect(await screen.findByText("Preencha este campo.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveAccessibleDescription("Preencha este campo.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
