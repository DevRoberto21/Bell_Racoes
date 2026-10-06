import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClienteDetalhe, NotaResumo } from "../../api/tipos";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { Busca } from "./Busca";

function nota(codigo: string): NotaResumo {
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
  };
}

const cliente: ClienteDetalhe = {
  codigo: 12,
  codigo_formatado: "12",
  nome: "José Pereira",
  apelido: "Zé",
  telefone: "",
  divida: "241.10",
  notas_abertas: 2,
  notas: [nota("12-01"), nota("12-03")],
  tem_continua_aberta: false,
  pode_excluir: false,
};

let fetchSimulado: ReturnType<typeof vi.fn>;

function simular(corpo: unknown) {
  fetchSimulado = vi.fn().mockResolvedValue(responder(corpo));
  vi.stubGlobal("fetch", fetchSimulado);
}

async function esvaziar() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
  }
}

async function digitar(texto: string) {
  const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const campo = screen.getByPlaceholderText("Código (12 ou 12-03) ou nome");
  await usuario.type(campo, texto);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
  await esvaziar();
  return { usuario, campo };
}

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Busca", () => {
  it("consulta /api/busca?q=12 uma vez, depois da espera", async () => {
    simular({ tipo: "lista", clientes: [] });
    renderizarComApp(<Busca />);
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await usuario.type(screen.getByLabelText("Busca rápida"), "12");
    expect(fetchSimulado).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(fetchSimulado.mock.calls[0][0]).toBe("/api/busca?q=12");
  });

  it("mostra o cliente e suas notas; Enter navega para o cliente", async () => {
    simular({ tipo: "cliente", cliente });
    renderizarComApp(<Busca />);
    const { usuario } = await digitar("12");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByText("José Pereira")).toBeInTheDocument();
    expect(screen.getByText("12-03")).toBeInTheDocument();
    await usuario.keyboard("{Enter}");
    expect(screen.getByTestId("local")).toHaveTextContent("/clientes/12");
  });

  it("nota + Enter põe ?nota= no endereço e limpa o campo", async () => {
    simular({ tipo: "nota", nota: nota("12-03") });
    renderizarComApp(<Busca />);
    const { usuario, campo } = await digitar("12-03");
    await usuario.keyboard("{Enter}");
    expect(screen.getByTestId("local")).toHaveTextContent("/?nota=12-03");
    expect(campo).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("seta para baixo duas vezes + Enter abre a segunda nota do cliente", async () => {
    simular({ tipo: "cliente", cliente });
    renderizarComApp(<Busca />);
    const { usuario } = await digitar("12");
    await usuario.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByTestId("local")).toHaveTextContent("/?nota=12-03");
  });

  it("não encontrado mostra a mensagem e mantém o texto", async () => {
    simular({ tipo: "nao_encontrado", mensagem: "Nota 99-01 não encontrada." });
    renderizarComApp(<Busca />);
    const { campo } = await digitar("99-01");
    expect(screen.getByText("Nota 99-01 não encontrada.")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(campo).toHaveValue("99-01");
  });

  it("lista vazia mostra a mensagem de nenhum cliente", async () => {
    simular({ tipo: "lista", clientes: [] });
    renderizarComApp(<Busca />);
    await digitar("zzz");
    expect(screen.getByText("Nenhum cliente encontrado.")).toBeInTheDocument();
  });

  it("Esc fecha a lista e mantém o texto", async () => {
    simular({ tipo: "cliente", cliente });
    renderizarComApp(<Busca />);
    const { campo } = await digitar("12");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    // fireEvent devolve false quando o keydown foi cancelado (preventDefault): sem isso,
    // Chrome e Safari limpam o campo type="search" ao apertar Esc.
    const seguiu = fireEvent.keyDown(campo, { key: "Escape" });
    expect(seguiu).toBe(false);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(campo).toHaveValue("12");
  });
});
