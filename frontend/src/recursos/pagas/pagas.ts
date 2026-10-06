import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requisitar } from "../../api/http";
import type { NotaResumo } from "../../api/tipos";
import { abrirImpressao } from "../notas/imprimir";
import { buscarNota } from "../notas/notas";

/** Notas quitadas nos últimos 7 dias. */
export function usePagas() {
  return useQuery({
    queryKey: ["pagas"],
    queryFn: () => requisitar<NotaResumo[]>("GET", "/api/pagas"),
  });
}

/**
 * Reimprime uma nota da lista. A lista traz só o resumo, sem `imprimir_url`: o endereço vem da nota
 * completa, buscada na hora.
 */
export function useReimprimir() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => buscarNota(cliente, codigo),
    onSuccess: (nota) => abrirImpressao(nota.imprimir_url),
  });
}
