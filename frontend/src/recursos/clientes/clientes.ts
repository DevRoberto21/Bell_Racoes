import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { requisitar } from "../../api/http";
import type { ClienteDetalhe, ClienteLinha, Nota, TipoNota } from "../../api/tipos";

const ESPERA_MS = 150;

export interface DadosCliente {
  nome: string;
  apelido: string;
  telefone: string;
}

export function useClientes(q: string) {
  const limpo = q.trim();
  const [espera, setEspera] = useState(limpo);
  useEffect(() => {
    if (limpo === espera) return;
    const temporizador = setTimeout(() => setEspera(limpo), ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [limpo, espera]);

  return useQuery({
    queryKey: ["clientes", espera],
    queryFn: () => requisitar<ClienteLinha[]>("GET", `/api/clientes?q=${encodeURIComponent(espera)}`),
    placeholderData: keepPreviousData,
  });
}

export function useCliente(codigo: string) {
  return useQuery({
    queryKey: ["cliente", codigo],
    queryFn: () => requisitar<ClienteDetalhe>("GET", `/api/clientes/${codigo}`),
    retry: (tentativas, erro) => (erro as { status?: number }).status !== 404 && tentativas < 2,
  });
}

function invalidar(cliente: QueryClient, codigo?: string | number) {
  const consultas: unknown[][] = [["clientes"], ["painel"]];
  if (codigo !== undefined) consultas.push(["cliente", String(codigo)]);
  return Promise.all(consultas.map((queryKey) => cliente.invalidateQueries({ queryKey })));
}

export function useCriarCliente() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosCliente) => requisitar<ClienteDetalhe>("POST", "/api/clientes", dados),
    onSuccess: (criado) => invalidar(cliente, criado.codigo),
  });
}

export function useEditarCliente(codigo: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosCliente) => requisitar<ClienteDetalhe>("PATCH", `/api/clientes/${codigo}`, dados),
    onSuccess: () => invalidar(cliente, codigo),
  });
}

export function useExcluirCliente(codigo: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => requisitar<object>("DELETE", `/api/clientes/${codigo}`),
    onSuccess: () => {
      cliente.removeQueries({ queryKey: ["cliente", codigo] });
      return invalidar(cliente);
    },
  });
}

export function useCriarNota(codigo: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (tipo: TipoNota) => requisitar<Nota>("POST", `/api/clientes/${codigo}/notas`, { tipo }),
    onSuccess: () => invalidar(cliente, codigo),
  });
}
