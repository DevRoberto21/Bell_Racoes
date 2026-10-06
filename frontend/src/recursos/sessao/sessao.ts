import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requisitar } from "../../api/http";
import type { Usuario } from "../../api/tipos";

interface RespostaSessao {
  usuario: Usuario | null;
}

const chaveSessao = ["sessao"];

export function useSessao() {
  return useQuery({
    queryKey: chaveSessao,
    queryFn: () => requisitar<RespostaSessao>("GET", "/api/sessao"),
    staleTime: Infinity,
  });
}

export function useEntrar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: { usuario: string; senha: string }) =>
      requisitar<RespostaSessao>("POST", "/api/entrar", dados),
    onSuccess: (resposta) => cliente.setQueryData(chaveSessao, resposta),
  });
}

export function useSair() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => requisitar<RespostaSessao>("POST", "/api/sair"),
    onSuccess: (resposta) => {
      cliente.clear();
      cliente.setQueryData(chaveSessao, resposta);
    },
  });
}
