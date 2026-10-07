import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { paraDecimal } from "../../api/numero";
import { Botao } from "../../componentes/Botao";
import { Campo } from "../../componentes/Campo";
import type { DadosItem } from "./notas";
import { useSugestoesDeItem } from "./useSugestoesDeItem";
import "./LinhaNovoItem.css";

interface Props {
  /** Rejeita quando o item não entra; quem chama mostra o erro. */
  aoAdicionar: (dados: DadosItem) => Promise<unknown>;
  /** Outra gravação da nota está em curso. */
  bloqueado?: boolean;
}

const ERRO_NUMERO = "Número inválido.";

export function LinhaNovoItem({ aoAdicionar, bloqueado = false }: Props) {
  const formulario = useRef<HTMLFormElement>(null);
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [preco, setPreco] = useState("");
  const [invalido, setInvalido] = useState({ quantidade: false, preco: false });
  const [enviando, setEnviando] = useState(false);
  const [listaAberta, setListaAberta] = useState(false);
  // -1: nenhuma sugestão destacada, e o Enter envia o que foi digitado.
  const [indice, setIndice] = useState(-1);
  const idLista = useId();
  const sugestoes = useSugestoesDeItem(descricao).filter((sugestao) => sugestao !== descricao.trim());
  const listaVisivel = listaAberta && sugestoes.length > 0;
  const ativo = Math.min(indice, sugestoes.length - 1);

  function focar(nome: string) {
    const campo = formulario.current?.elements.namedItem(nome);
    if (campo instanceof HTMLInputElement) campo.focus();
  }
  const focarDescricao = () => focar("descricao");

  function aceitar(sugestao: string) {
    setDescricao(sugestao);
    setListaAberta(false);
    setIndice(-1);
  }

  function aoTeclarNaDescricao(evento: KeyboardEvent<HTMLInputElement>) {
    if (!listaVisivel) return;
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation(); // fecha só a lista, não a gaveta em volta
      setListaAberta(false);
      setIndice(-1);
    } else if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      setIndice(Math.max(-1, Math.min(ativo + passo, sugestoes.length - 1)));
    } else if (evento.key === "Enter" && ativo >= 0) {
      evento.preventDefault();
      aceitar(sugestoes[ativo]);
      focar("quantidade");
    } else if (evento.key === "Tab" && !evento.shiftKey && ativo >= 0) {
      aceitar(sugestoes[ativo]); // o próprio Tab leva o foco à quantidade
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando || bloqueado) return;
    const quantidadeDecimal = paraDecimal(quantidade, 3);
    const precoDecimal = paraDecimal(preco, 2);
    setInvalido({ quantidade: quantidadeDecimal === null, preco: precoDecimal === null });
    if (quantidadeDecimal === null || precoDecimal === null) return;
    const texto = descricao.trim();
    if (!texto) {
      focarDescricao();
      return;
    }
    setEnviando(true);
    try {
      await aoAdicionar({ descricao: texto, quantidade: quantidadeDecimal, preco_unitario: precoDecimal });
      setDescricao("");
      setQuantidade("1");
      setPreco("");
      focarDescricao();
    } catch {
      // O que foi digitado fica como está; o erro aparece no aviso da gaveta.
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form ref={formulario} className="novo-item" onSubmit={enviar} noValidate>
      <div className="novo-item__descricao">
        <Campo
          rotulo="Descrição"
          name="descricao"
          role="combobox"
          aria-expanded={listaVisivel}
          aria-controls={idLista}
          aria-activedescendant={listaVisivel && ativo >= 0 ? `${idLista}-${ativo}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={descricao}
          onChange={(e) => {
            setDescricao(e.target.value);
            setListaAberta(true);
            setIndice(-1);
          }}
          onKeyDown={aoTeclarNaDescricao}
          onBlur={() => setListaAberta(false)}
        />
        {listaVisivel && (
          <ul className="novo-item__sugestoes" role="listbox" id={idLista} aria-label="Descrições já usadas">
            {sugestoes.map((sugestao, i) => (
              <li
                key={sugestao}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={i === ativo}
                className={`novo-item__sugestao${i === ativo ? " novo-item__sugestao--ativa" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setIndice(i)}
                onClick={() => {
                  aceitar(sugestao);
                  focar("quantidade");
                }}
              >
                {sugestao}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Campo
        rotulo="Quantidade"
        name="quantidade"
        inputMode="decimal"
        autoComplete="off"
        value={quantidade}
        erro={invalido.quantidade ? ERRO_NUMERO : undefined}
        onChange={(e) => {
          setQuantidade(e.target.value);
          setInvalido((atual) => ({ ...atual, quantidade: false }));
        }}
      />
      <Campo
        rotulo="Preço"
        name="preco"
        inputMode="decimal"
        autoComplete="off"
        value={preco}
        erro={invalido.preco ? ERRO_NUMERO : undefined}
        onChange={(e) => {
          setPreco(e.target.value);
          setInvalido((atual) => ({ ...atual, preco: false }));
        }}
      />
      <Botao type="submit" variante="contorno" className="novo-item__enviar" disabled={enviando || bloqueado}>
        Adicionar
      </Botao>
    </form>
  );
}
