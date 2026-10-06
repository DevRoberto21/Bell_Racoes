import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { aoExpirarSessao, requisitar } from "../../api/http";
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

/**
 * Sessão expirada: um 401 em qualquer requisição zera o usuário no cache. A rota protegida então leva
 * para /entrar?depois=<endereço atual>; vários 401 juntos gravam o mesmo valor, sem novo redirecionamento.
 */
export function useSessaoExpirada() {
  const cliente = useQueryClient();
  useEffect(() => aoExpirarSessao(() => cliente.setQueryData<RespostaSessao>(chaveSessao, { usuario: null })), [cliente]);
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
