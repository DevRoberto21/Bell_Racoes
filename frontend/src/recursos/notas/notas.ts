import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ErroApi, requisitar, type Metodo } from "../../api/http";
import type { FormaPagamento, Nota } from "../../api/tipos";

const ERRO_GENERICO = "Não foi possível concluir. Tente de novo.";

export interface DadosItem {
  descricao: string;
  quantidade: string;
  preco_unitario: string;
}

export interface DadosPagamento {
  valor: string;
  forma: FormaPagamento;
}

/** "01-03" vira "/api/notas/1-3": a API recebe cliente e número sem zeros à esquerda. */
export function caminhoDaNota(codigo: string): string {
  const [cliente, numero] = codigo.split("-").map((parte) => parseInt(parte, 10));
  return `/api/notas/${cliente}-${numero}`;
}

const chaveDaNota = (codigo: string | null) => ["nota", codigo];

export function useNota(codigo: string | null) {
  return useQuery({
    queryKey: chaveDaNota(codigo),
    queryFn: () => requisitar<Nota>("GET", caminhoDaNota(codigo as string)),
    enabled: codigo !== null,
  });
}

function notaNoCache(cliente: QueryClient, codigo: string) {
  return cliente.getQueryData<Nota>(chaveDaNota(codigo));
}

function invalidarListas(cliente: QueryClient, codigoDoCliente?: number) {
  const consultas: unknown[][] = [["painel"], ["clientes"], ["pagas"]];
  if (codigoDoCliente !== undefined) consultas.push(["cliente", String(codigoDoCliente)]);
  return Promise.all(consultas.map((queryKey) => cliente.invalidateQueries({ queryKey })));
}

/** Grava no cache a nota que o servidor devolveu. */
function gravarNota(cliente: QueryClient, codigo: string, nota: Nota) {
  cliente.setQueryData(chaveDaNota(codigo), nota);
  // Sem esperar: a mutação termina com a resposta do servidor (a impressão abre logo) e as listas recarregam ao fundo.
  void invalidarListas(cliente, nota.cliente.codigo);
}

/** Mutação que devolve a nota atualizada: envia a versão do cache (ou a que o corpo trouxer) e grava a resposta no lugar. */
function useMutacaoDaNota<V>(codigo: string, pedido: (dados: V) => { metodo: Metodo; sufixo: string; corpo?: object }) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: V) => {
      const { metodo, sufixo, corpo } = pedido(dados);
      const versao = notaNoCache(cliente, codigo)?.versao;
      return requisitar<Nota>(metodo, caminhoDaNota(codigo) + sufixo, { versao, ...corpo });
    },
    onSuccess: (nota) => gravarNota(cliente, codigo, nota),
  });
}

export function useAdicionarItem(codigo: string) {
  return useMutacaoDaNota(codigo, (item: DadosItem) => ({ metodo: "POST", sufixo: "/itens", corpo: item }));
}

export function useRemoverItem(codigo: string) {
  return useMutacaoDaNota(codigo, (id: number) => ({ metodo: "DELETE", sufixo: `/itens/${id}` }));
}

export function useFinalizar(codigo: string) {
  return useMutacaoDaNota<void>(codigo, () => ({ metodo: "POST", sufixo: "/finalizar" }));
}

export function useFechar(codigo: string) {
  return useMutacaoDaNota<void>(codigo, () => ({ metodo: "POST", sufixo: "/fechar" }));
}

/**
 * Corrige a nota: a lista enviada substitui os itens; linha toda em branco é ignorada pelo servidor.
 * `versao` é a da nota que o formulário copiou, não a do cache: se a nota mudou desde então, o servidor recusa (409).
 */
export function useCorrigir(codigo: string) {
  return useMutacaoDaNota(codigo, (correcao: { itens: DadosItem[]; versao: number }) => ({
    metodo: "PUT",
    sufixo: "/itens",
    corpo: correcao,
  }));
}

/**
 * Recebe um pagamento. A resposta traz a nota atualizada e o endereço do recibo a imprimir.
 * `versao` é a da nota quando o formulário abriu, não a do cache.
 */
export function useReceber(codigo: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (pagamento: DadosPagamento & { versao: number }) =>
      requisitar<{ recibo_url: string; nota: Nota }>("POST", `${caminhoDaNota(codigo)}/pagamentos`, pagamento),
    onSuccess: ({ nota }) => gravarNota(cliente, codigo, nota),
  });
}

export function useDescartar(codigo: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const nota = notaNoCache(cliente, codigo);
      await requisitar<object>("DELETE", caminhoDaNota(codigo), { versao: nota?.versao });
      return nota?.cliente.codigo;
    },
    onSuccess: (codigoDoCliente) => {
      cliente.removeQueries({ queryKey: chaveDaNota(codigo) });
      // Só o descarte espera as listas: a gaveta fecha já sobre a tela sem a nota descartada.
      return invalidarListas(cliente, codigoDoCliente);
    },
  });
}

/** Mensagem a mostrar para um erro vindo de uma requisição. */
export function mensagemDeErro(erro: unknown): string {
  return erro instanceof ErroApi ? erro.message : ERRO_GENERICO;
}

/** Mensagem a mostrar para um erro numa ação da nota; em conflito de versão (409) também recarrega a nota. */
export function tratarErroDeNota(clienteDeConsulta: QueryClient, erro: unknown, codigo: string): string {
  if (erro instanceof ErroApi && erro.status === 409) {
    void clienteDeConsulta.invalidateQueries({ queryKey: chaveDaNota(codigo) });
  }
  return mensagemDeErro(erro);
}
