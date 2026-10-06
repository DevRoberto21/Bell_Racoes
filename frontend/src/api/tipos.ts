// Formas JSON devolvidas pela API (fiado/api/serializadores.py).
// Dinheiro e quantidade são sempre texto com ponto ("96.40", "1.500").

export interface Usuario {
  nome_de_usuario: string;
  nome: string;
}

export type TipoNota = "UNICA" | "CONTINUA";
export type SituacaoNota = "RASCUNHO" | "ABERTA" | "FECHADA" | "QUITADA";
export type FormaPagamento = "DINHEIRO" | "PIX" | "CARTAO";

export interface ClienteLinha {
  codigo: number;
  codigo_formatado: string;
  nome: string;
  apelido: string;
  telefone: string;
  divida: string;
  notas_abertas: number;
}

export interface NotaResumo {
  codigo: string;
  cliente: { codigo: number; codigo_formatado: string; nome: string };
  numero: number;
  tipo: TipoNota;
  tipo_rotulo: string;
  situacao: SituacaoNota;
  situacao_rotulo: string;
  criada_em: string;
  quitada_em: string | null;
  editada: boolean;
  dias_em_aberto: number;
  nivel_alerta: number;
  total: string;
  saldo: string;
  imprimir_url: string;
}

export interface ClienteDetalhe extends ClienteLinha {
  notas: NotaResumo[];
  tem_continua_aberta: boolean;
  pode_excluir: boolean;
}

export interface ItemNota {
  id: number;
  descricao: string;
  quantidade: string;
  preco_unitario: string;
  subtotal: string;
}

export interface Pagamento {
  id: number;
  valor: string;
  forma: FormaPagamento;
  forma_rotulo: string;
  recebido_em: string;
  recebido_por: string;
  recibo_url: string;
}

export interface AcoesDaNota {
  adicionar_item: boolean;
  remover_item: boolean;
  finalizar: boolean;
  fechar: boolean;
  descartar: boolean;
  receber: boolean;
  corrigir: boolean;
  imprimir: boolean;
}

export interface Nota extends NotaResumo {
  editada_em: string | null;
  versao: number;
  total_pago: string;
  itens: ItemNota[];
  pagamentos: Pagamento[];
  acoes: AcoesDaNota;
}

export interface Painel {
  total_em_aberto: string;
  alertas: NotaResumo[];
  rascunhos: NotaResumo[];
  backup_falhou: boolean;
}

export type ResultadoBusca =
  | { tipo: "nota"; nota: NotaResumo }
  | { tipo: "cliente"; cliente: ClienteDetalhe }
  | { tipo: "nao_encontrado"; mensagem: string }
  | { tipo: "lista"; clientes: ClienteLinha[] };

export interface PreviaDivida {
  divida: string;
  sobra: string;
  partes: { codigo: string; saldo: string; parte: string }[];
}
