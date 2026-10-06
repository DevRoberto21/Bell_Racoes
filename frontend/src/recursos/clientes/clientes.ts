import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ErroApi, requisitar } from "../../api/http";
import type { ClienteDetalhe, ClienteLinha, FormaPagamento, Nota, PreviaDivida, TipoNota } from "../../api/tipos";

const ESPERA_MS = 150;
const ESPERA_DA_PREVIA_MS = 200;

export interface DadosCliente {
  nome: string;
  apelido: string;
  telefone: string;
}

export interface DadosPagamentoDaDivida {
  valor: string;
  forma: FormaPagamento;
  /** A dívida que a tela mostrava: se já for outra, o servidor recusa com 409. */
  divida_esperada: string;
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

/** Exclui o cliente. Quem chama navega para fora da tela dele e só então chama `limpar`. */
export function useExcluirCliente(codigo: string) {
  const cliente = useQueryClient();
  const excluir = useMutation({
    mutationFn: () => requisitar<object>("DELETE", `/api/clientes/${codigo}`),
  });
  /** Descarta o cache do cliente excluído e atualiza listas e painel; chamar depois de sair da tela dele. */
  function limpar() {
    cliente.removeQueries({ queryKey: ["cliente", codigo] });
    return invalidar(cliente);
  }
  return { ...excluir, limpar };
}

export function useCriarNota(codigo: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (tipo: TipoNota) => requisitar<Nota>("POST", `/api/clientes/${codigo}/notas`, { tipo }),
    onSuccess: () => invalidar(cliente, codigo),
  });
}

/**
 * Distribuição de `valor` ("100.00", ou null quando o digitado não é número) pelas notas do cliente.
 * Enquanto o valor muda, espera 200 ms sem digitação antes de consultar; `previa` só existe quando
 * corresponde ao valor atual.
 */
export function usePreviaDivida(clienteCodigo: string, valor: string | null) {
  const [espera, setEspera] = useState(valor);
  useEffect(() => {
    if (valor === espera) return;
    const temporizador = setTimeout(() => setEspera(valor), ESPERA_DA_PREVIA_MS);
    return () => clearTimeout(temporizador);
  }, [valor, espera]);

  const consulta = useQuery({
    // Debaixo da chave do cliente: recarregar o cliente recarrega também a prévia em uso.
    queryKey: ["cliente", clienteCodigo, "previa", espera],
    queryFn: () =>
      requisitar<PreviaDivida>("GET", `/api/clientes/${clienteCodigo}/divida/previa?valor=${encodeURIComponent(espera as string)}`),
    enabled: espera !== null,
    // Fora de uso a prévia é descartada: a dívida muda a cada pagamento, e uma prévia velha enganaria.
    gcTime: 0,
  });
  return { previa: espera === valor ? consulta.data : undefined };
}

/** Paga a dívida do cliente. A resposta traz o cliente atualizado e o endereço do recibo a imprimir. */
export function usePagarDivida(clienteCodigo: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosPagamentoDaDivida) =>
      requisitar<{ recibo_url: string; cliente: ClienteDetalhe }>("POST", `/api/clientes/${clienteCodigo}/pagamentos`, dados),
    onSuccess: (resposta) => {
      cliente.setQueryData(["cliente", clienteCodigo], resposta.cliente);
      // Sem esperar: a mutação termina com a resposta do servidor (o recibo abre logo) e o resto recarrega ao fundo.
      for (const queryKey of [["clientes"], ["painel"], ["pagas"], ["nota"]]) void cliente.invalidateQueries({ queryKey });
    },
    onError: (erro) => {
      // A dívida mudou em outra tela: busca o cliente e a prévia de novo.
      if (erro instanceof ErroApi && erro.status === 409) {
        void cliente.invalidateQueries({ queryKey: ["cliente", clienteCodigo] });
      }
    },
  });
}
