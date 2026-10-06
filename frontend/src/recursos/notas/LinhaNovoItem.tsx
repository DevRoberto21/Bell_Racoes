import { useRef, useState, type FormEvent } from "react";
import { paraDecimal } from "../../api/numero";
import { Botao } from "../../componentes/Botao";
import { Campo } from "../../componentes/Campo";
import type { DadosItem } from "./notas";
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

  function focarDescricao() {
    const campo = formulario.current?.elements.namedItem("descricao");
    if (campo instanceof HTMLInputElement) campo.focus();
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
      <Campo
        className="novo-item__descricao"
        rotulo="Descrição"
        name="descricao"
        autoComplete="off"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />
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
