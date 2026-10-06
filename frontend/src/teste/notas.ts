import { vi } from "vitest";
import type { AcoesDaNota, Nota } from "../api/tipos";

const NENHUMA: AcoesDaNota = {
  adicionar_item: false,
  remover_item: false,
  finalizar: false,
  fechar: false,
  descartar: false,
  receber: false,
  corrigir: false,
  imprimir: false,
};

/** Ações de uma nota fechada com saldo: receber, corrigir e reimprimir. */
export const ACOES_FECHADA: AcoesDaNota = { ...NENHUMA, receber: true, corrigir: true, imprimir: true };

/** Nota 01-01 fechada, com dois itens e saldo de 160,00. */
export function notaDeTeste(extras: Partial<Nota> = {}): Nota {
  return {
    codigo: "01-01",
    cliente: { codigo: 1, codigo_formatado: "01", nome: "Maria" },
    numero: 1,
    tipo: "UNICA",
    tipo_rotulo: "Única",
    situacao: "FECHADA",
    situacao_rotulo: "Fechada",
    criada_em: "2026-09-28T12:00:00-03:00",
    quitada_em: null,
    editada: false,
    dias_em_aberto: 3,
    nivel_alerta: 0,
    total: "160.00",
    saldo: "160.00",
    editada_em: null,
    versao: 4,
    total_pago: "0.00",
    itens: [
      { id: 7, descricao: "Ração 15kg", quantidade: "1.500", preco_unitario: "40.00", subtotal: "60.00" },
      { id: 8, descricao: "Milho", quantidade: "2.000", preco_unitario: "50.00", subtotal: "100.00" },
    ],
    pagamentos: [],
    acoes: ACOES_FECHADA,
    imprimir_url: "/notas/1-1/imprimir/",
    ...extras,
  };
}

/** Troca o `fetch` global: `rotas` recebe "MÉTODO /caminho" e devolve a resposta (ou uma promessa dela). */
export function simularFetch(rotas: (chave: string) => unknown) {
  const simulado = vi.fn(async (url: string, opcoes?: RequestInit) => {
    const chave = `${opcoes?.method ?? "GET"} ${url}`;
    const resposta = rotas(chave);
    if (resposta === undefined) throw new Error(`requisição inesperada: ${chave}`);
    return resposta;
  });
  vi.stubGlobal("fetch", simulado);
  const chamadas = () => simulado.mock.calls.map(([url, o]) => `${o?.method ?? "GET"} ${url}`);
  return {
    chamadas,
    quantas: (chave: string) => chamadas().filter((c) => c === chave).length,
    corpoDe: (chave: string) => {
      const chamada = simulado.mock.calls.find(([url, o]) => `${o?.method ?? "GET"} ${url}` === chave);
      return JSON.parse(chamada![1]!.body as string);
    },
  };
}

/** Promessa que só termina quando o teste manda. */
export function adiado() {
  let liberar: () => void = () => {};
  const promessa = new Promise<void>((resolve) => (liberar = resolve));
  return { promessa, liberar: () => liberar() };
}
