import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ErroApi } from "../../api/http";
import { formatarDinheiro, formatarQuantidade, paraDecimal } from "../../api/numero";
import type { ItemNota } from "../../api/tipos";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { mensagemDeErro, type DadosItem } from "./notas";
import "../../componentes/Campo.css";
import "./Correcao.css";

interface Props {
  itens: ItemNota[];
  /** Versão da nota a que `itens` pertence. */
  versao: number;
  /** Recebe a lista e a versão da nota que o formulário copiou ao abrir. Rejeita quando a correção não entra; o erro aparece aqui no formulário. */
  aoSalvar: (itens: DadosItem[], versao: number) => Promise<unknown>;
  aoCancelar: () => void;
}

type CampoDoItem = keyof DadosItem;

const ERRO_NUMERO = "Número inválido.";
const EM_BRANCO: DadosItem = { descricao: "", quantidade: "", preco_unitario: "" };
const COLUNAS: { campo: CampoDoItem; rotulo: string; numerico: boolean }[] = [
  { campo: "descricao", rotulo: "Descrição", numerico: false },
  { campo: "quantidade", rotulo: "Quantidade", numerico: true },
  { campo: "preco_unitario", rotulo: "Preço", numerico: true },
];

/** Chave do erro de um campo: a mesma que o servidor usa, "itens.<linha>.<campo>". */
const chaveDoErro = (linha: number, campo: CampoDoItem) => `itens.${linha}.${campo}`;

/** Os itens da nota como campos editáveis, no lugar da lista. */
export function Correcao({ itens, versao, aoSalvar, aoCancelar }: Props) {
  const formulario = useRef<HTMLFormElement>(null);
  const idDosErros = useId();
  // As linhas guardam o texto como aparece na tela; nunca saem do lugar, então o índice identifica cada uma.
  const [linhas, setLinhas] = useState<DadosItem[]>(() =>
    itens.map((item) => ({
      descricao: item.descricao,
      quantidade: formatarQuantidade(item.quantidade),
      preco_unitario: formatarDinheiro(item.preco_unitario),
    })),
  );
  // A versão da nota copiada acima: a nota pode ser recarregada com o formulário aberto, as linhas não.
  const [versaoCopiada] = useState(versao);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  // Linha cuja descrição recebe o foco: a primeira ao abrir, a nova ao adicionar.
  const [linhaEmFoco, setLinhaEmFoco] = useState(0);

  useEffect(() => {
    formulario.current?.querySelector<HTMLInputElement>(`[name="descricao-${linhaEmFoco}"]`)?.focus();
  }, [linhaEmFoco]);

  function mudar(linha: number, campo: CampoDoItem, texto: string) {
    setLinhas((atuais) => atuais.map((dados, i) => (i === linha ? { ...dados, [campo]: texto } : dados)));
    setErros((atuais) => {
      const resto = { ...atuais };
      delete resto[chaveDoErro(linha, campo)];
      return resto;
    });
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    const invalidos: Record<string, string> = {};
    const lista = linhas.map((linha, i) => {
      // Linha toda em branco vai em branco: o servidor a ignora.
      if (Object.values(linha).every((texto) => !texto.trim())) return EM_BRANCO;
      const quantidade = paraDecimal(linha.quantidade, 3);
      const preco = paraDecimal(linha.preco_unitario, 2);
      if (quantidade === null) invalidos[chaveDoErro(i, "quantidade")] = ERRO_NUMERO;
      if (preco === null) invalidos[chaveDoErro(i, "preco_unitario")] = ERRO_NUMERO;
      return { descricao: linha.descricao.trim(), quantidade: quantidade ?? "", preco_unitario: preco ?? "" };
    });
    setFalha(undefined);
    setErros(invalidos);
    if (Object.keys(invalidos).length > 0) return;
    setEnviando(true);
    try {
      await aoSalvar(lista, versaoCopiada);
    } catch (erro) {
      setFalha(mensagemDeErro(erro));
      if (erro instanceof ErroApi) setErros(erro.campos);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form ref={formulario} className="correcao" aria-label="Correção dos itens" noValidate onSubmit={enviar}>
      <h3 className="correcao__titulo">Itens</h3>
      {falha && <Aviso tipo="erro">{falha}</Aviso>}
      <div className="correcao__linhas">
        <div className="correcao__linha correcao__rotulos" aria-hidden="true">
          {COLUNAS.map((coluna) => (
            <span key={coluna.campo}>{coluna.rotulo}</span>
          ))}
        </div>
        {linhas.map((linha, i) => (
          <div key={i} className="correcao__linha">
            {COLUNAS.map(({ campo, rotulo, numerico }) => {
              const erro = erros[chaveDoErro(i, campo)];
              const idErro = `${idDosErros}-${i}-${campo}`;
              return (
                <div key={campo} className="correcao__campo">
                  <input
                    className="campo__entrada"
                    name={`${campo}-${i}`}
                    aria-label={`${rotulo} do item ${i + 1}`}
                    aria-invalid={erro ? true : undefined}
                    aria-describedby={erro ? idErro : undefined}
                    inputMode={numerico ? "decimal" : undefined}
                    autoComplete="off"
                    value={linha[campo]}
                    onChange={(e) => mudar(i, campo, e.target.value)}
                  />
                  {erro && (
                    <p className="campo__erro" id={idErro}>
                      {erro}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <Botao
        variante="contorno"
        className="correcao__adicionar"
        disabled={enviando}
        onClick={() => {
          setLinhas((atuais) => [...atuais, EM_BRANCO]);
          setLinhaEmFoco(linhas.length);
        }}
      >
        Adicionar linha
      </Botao>
      <div className="correcao__acoes">
        <Botao variante="contorno" onClick={aoCancelar} disabled={enviando}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={enviando}>
          Salvar correção e reimprimir
        </Botao>
      </div>
    </form>
  );
}
