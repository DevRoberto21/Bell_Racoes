import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroApi } from "../../api/http";
import type { Nota } from "../../api/tipos";
import { responder } from "../../teste/renderizar";
import {
  caminhoDaNota,
  tratarErroDeNota,
  useAdicionarItem,
  useDescartar,
  useFechar,
  useFinalizar,
  useNota,
  useRemoverItem,
} from "./notas";

const CODIGO = "01-03";

function nota(versao: number, extras: Partial<Nota> = {}): Nota {
  return {
    codigo: CODIGO,
    cliente: { codigo: 1, codigo_formatado: "01", nome: "Maria" },
    numero: 3,
    tipo: "UNICA",
    tipo_rotulo: "Única",
    situacao: "RASCUNHO",
    situacao_rotulo: "Rascunho",
    criada_em: "2026-10-05T10:00:00-03:00",
    quitada_em: null,
    editada: false,
    dias_em_aberto: 0,
    nivel_alerta: 0,
    total: "0.00",
    saldo: "0.00",
    editada_em: null,
    versao,
    total_pago: "0.00",
    itens: [],
    pagamentos: [],
    acoes: {
      adicionar_item: true,
      remover_item: true,
      finalizar: true,
      fechar: false,
      descartar: true,
      receber: false,
      corrigir: false,
      imprimir: false,
    },
    imprimir_url: "/notas/1-3/imprimir",
    ...extras,
  };
}

let fetchSimulado: ReturnType<typeof vi.fn>;
let cliente: QueryClient;

function envolver({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

function chamadas(metodo: string) {
  return fetchSimulado.mock.calls.filter(([, o]) => (o as RequestInit).method === metodo);
}

function corpo(chamada: unknown[]) {
  return JSON.parse((chamada[1] as RequestInit).body as string);
}

beforeEach(() => {
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fetchSimulado = vi.fn(async (url: string, opcoes?: RequestInit) => {
    if (opcoes?.method === "GET") return responder(nota(7));
    if (opcoes?.method === "DELETE" && !url.includes("/itens/")) return responder({});
    return responder(nota(8, { total: "25.00" }));
  });
  vi.stubGlobal("fetch", fetchSimulado);
});

afterEach(() => vi.unstubAllGlobals());

describe("caminhoDaNota", () => {
  it.each([
    ["01-03", "/api/notas/1-3"],
    ["12-03", "/api/notas/12-3"],
    ["105-10", "/api/notas/105-10"],
  ])("%s vira %s", (codigo, caminho) => {
    expect(caminhoDaNota(codigo)).toBe(caminho);
  });
});

describe("useNota", () => {
  it("busca a nota pelo caminho do código", async () => {
    const { result } = renderHook(() => useNota(CODIGO), { wrapper: envolver });
    await waitFor(() => expect(result.current.data?.versao).toBe(7));
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(fetchSimulado.mock.calls[0][0]).toBe("/api/notas/1-3");
    expect(cliente.getQueryData(["nota", CODIGO])).toEqual(nota(7));
  });

  it("sem código não busca nada", async () => {
    const { result } = renderHook(() => useNota(null), { wrapper: envolver });
    await Promise.resolve();
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});

describe("mutações da nota", () => {
  beforeEach(() => {
    cliente.setQueryData(["nota", CODIGO], nota(7));
  });

  it("adicionar item envia POST com a versão do cache e os dados do item", async () => {
    const { result } = renderHook(() => useAdicionarItem(CODIGO), { wrapper: envolver });
    await act(() => result.current.mutateAsync({ descricao: "Ração 15kg", quantidade: "1.500", preco_unitario: "96.40" }));
    const [chamada] = chamadas("POST");
    expect(chamada[0]).toBe("/api/notas/1-3/itens");
    expect(corpo(chamada)).toEqual({ versao: 7, descricao: "Ração 15kg", quantidade: "1.500", preco_unitario: "96.40" });
  });

  it("adicionar item com sucesso atualiza a nota no cache sem buscar de novo", async () => {
    const observada = renderHook(() => useNota(CODIGO), { wrapper: envolver });
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(cliente.isFetching()).toBe(0));
    const { result } = renderHook(() => useAdicionarItem(CODIGO), { wrapper: envolver });
    await act(() => result.current.mutateAsync({ descricao: "Ração", quantidade: "1", preco_unitario: "25.00" }));
    await waitFor(() => expect(observada.result.current.data?.versao).toBe(8));
    expect(observada.result.current.data?.total).toBe("25.00");
    expect(chamadas("GET")).toHaveLength(1);
  });

  it("a segunda mutação usa a versão devolvida pela primeira", async () => {
    const { result } = renderHook(() => useAdicionarItem(CODIGO), { wrapper: envolver });
    const item = { descricao: "Ração", quantidade: "1", preco_unitario: "25.00" };
    await act(() => result.current.mutateAsync(item));
    await act(() => result.current.mutateAsync(item));
    expect(chamadas("POST").map((c) => corpo(c).versao)).toEqual([7, 8]);
  });

  it("remover item envia DELETE do item com a versão", async () => {
    const { result } = renderHook(() => useRemoverItem(CODIGO), { wrapper: envolver });
    await act(() => result.current.mutateAsync(42));
    const [chamada] = chamadas("DELETE");
    expect(chamada[0]).toBe("/api/notas/1-3/itens/42");
    expect(corpo(chamada)).toEqual({ versao: 7 });
    expect(cliente.getQueryData<Nota>(["nota", CODIGO])?.versao).toBe(8);
  });

  it("finalizar envia POST em /finalizar com a versão", async () => {
    const { result } = renderHook(() => useFinalizar(CODIGO), { wrapper: envolver });
    await act(() => result.current.mutateAsync());
    const [chamada] = chamadas("POST");
    expect(chamada[0]).toBe("/api/notas/1-3/finalizar");
    expect(corpo(chamada)).toEqual({ versao: 7 });
    expect(cliente.getQueryData<Nota>(["nota", CODIGO])?.versao).toBe(8);
  });

  it("fechar envia POST em /fechar com a versão", async () => {
    const { result } = renderHook(() => useFechar(CODIGO), { wrapper: envolver });
    await act(() => result.current.mutateAsync());
    const [chamada] = chamadas("POST");
    expect(chamada[0]).toBe("/api/notas/1-3/fechar");
    expect(corpo(chamada)).toEqual({ versao: 7 });
  });

  it("descartar envia DELETE da nota com a versão e tira a nota do cache", async () => {
    const { result } = renderHook(() => useDescartar(CODIGO), { wrapper: envolver });
    await act(() => result.current.mutateAsync());
    const [chamada] = chamadas("DELETE");
    expect(chamada[0]).toBe("/api/notas/1-3");
    expect(corpo(chamada)).toEqual({ versao: 7 });
    expect(cliente.getQueryData(["nota", CODIGO])).toBeUndefined();
  });

  it("cada mutação invalida painel, cliente da nota, clientes e pagas", async () => {
    const invalidar = vi.spyOn(cliente, "invalidateQueries");
    const esperadas = [["painel"], ["cliente", "1"], ["clientes"], ["pagas"]];
    const chaves = () => invalidar.mock.calls.map(([filtro]) => filtro?.queryKey);

    const finalizar = renderHook(() => useFinalizar(CODIGO), { wrapper: envolver });
    await act(() => finalizar.result.current.mutateAsync());
    expect(chaves()).toEqual(expect.arrayContaining(esperadas));
    expect(chaves()).not.toContainEqual(["nota", CODIGO]);

    invalidar.mockClear();
    const descartar = renderHook(() => useDescartar(CODIGO), { wrapper: envolver });
    await act(() => descartar.result.current.mutateAsync());
    expect(chaves()).toEqual(expect.arrayContaining(esperadas));
  });
});

describe("tratarErroDeNota", () => {
  async function comNotaObservada() {
    const observada = renderHook(() => useNota(CODIGO), { wrapper: envolver });
    await waitFor(() => expect(observada.result.current.data?.versao).toBe(7));
    return observada;
  }

  it("em 409 devolve a mensagem da API e recarrega a nota", async () => {
    await comNotaObservada();
    const mensagem = tratarErroDeNota(cliente, new ErroApi("A nota mudou. Confira e tente de novo.", 409), CODIGO);
    expect(mensagem).toBe("A nota mudou. Confira e tente de novo.");
    await waitFor(() => expect(chamadas("GET")).toHaveLength(2));
  });

  it("em 400 devolve a mensagem e não recarrega", async () => {
    await comNotaObservada();
    const mensagem = tratarErroDeNota(cliente, new ErroApi("Quantidade inválida.", 400), CODIGO);
    expect(mensagem).toBe("Quantidade inválida.");
    await new Promise((r) => setTimeout(r, 20));
    expect(chamadas("GET")).toHaveLength(1);
  });

  it("erro que não é da API vira uma mensagem genérica", () => {
    expect(tratarErroDeNota(cliente, new TypeError("x"), CODIGO)).toBe("Não foi possível concluir. Tente de novo.");
  });
});
