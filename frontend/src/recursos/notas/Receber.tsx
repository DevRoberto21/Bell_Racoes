import { motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErroApi } from "../../api/http";
import { formatarDinheiro, paraDecimal } from "../../api/numero";
import type { FormaPagamento } from "../../api/tipos";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { Campo } from "../../componentes/Campo";
import { CampoForma } from "../../componentes/CampoForma";
import { molaBase } from "../../estilo/tempo";
import { mensagemDeErro, type DadosPagamento } from "./notas";
import "./Receber.css";

interface Props {
  /** Saldo da nota ("96.40"): é o valor que o formulário propõe. */
  saldo: string;
  /** Versão da nota a que `saldo` pertence. */
  versao: number;
  /** Recebe o pagamento e a versão da nota quando o formulário abriu. Rejeita quando o pagamento não entra; o erro aparece aqui no formulário. */
  aoConfirmar: (dados: DadosPagamento, versao: number) => Promise<unknown>;
  aoCancelar: () => void;
}

const ERRO_NUMERO = "Número inválido.";

/** Formulário de pagamento da nota: sobe de baixo, dentro da gaveta. */
export function Receber({ saldo, versao, aoConfirmar, aoCancelar }: Props) {
  const formulario = useRef<HTMLFormElement>(null);
  const [valor, setValor] = useState(() => formatarDinheiro(saldo));
  // A versão da nota quando o formulário abriu: a nota pode ser recarregada com ele aberto.
  const [versaoAoAbrir] = useState(versao);
  const [forma, setForma] = useState<FormaPagamento>("DINHEIRO");
  const [erroDoValor, setErroDoValor] = useState<string>();
  const [falha, setFalha] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const campo = formulario.current?.elements.namedItem("valor");
    if (campo instanceof HTMLInputElement) {
      campo.focus();
      campo.select();
    }
  }, []);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    const decimal = paraDecimal(valor, 2);
    setFalha(undefined);
    setErroDoValor(decimal === null ? ERRO_NUMERO : undefined);
    if (decimal === null) return;
    setEnviando(true);
    try {
      await aoConfirmar({ valor: decimal, forma }, versaoAoAbrir);
    } catch (erro) {
      setFalha(mensagemDeErro(erro));
      if (erro instanceof ErroApi) setErroDoValor(erro.campos.valor);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <motion.form
      ref={formulario}
      className="receber"
      aria-label="Receber pagamento"
      noValidate
      onSubmit={enviar}
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      transition={molaBase()}
    >
      {falha && <Aviso tipo="erro">{falha}</Aviso>}
      <div className="receber__campos">
        <Campo
          rotulo="Valor"
          name="valor"
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          erro={erroDoValor}
          onChange={(e) => {
            setValor(e.target.value);
            setErroDoValor(undefined);
          }}
        />
        <CampoForma valor={forma} aoMudar={setForma} />
      </div>
      <div className="receber__acoes">
        <Botao variante="contorno" onClick={aoCancelar} disabled={enviando}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={enviando}>
          Confirmar pagamento
        </Botao>
      </div>
    </motion.form>
  );
}
