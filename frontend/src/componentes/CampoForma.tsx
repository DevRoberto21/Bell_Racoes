import { useId } from "react";
import type { FormaPagamento } from "../api/tipos";
import "./Campo.css";

const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "DINHEIRO", rotulo: "Dinheiro" },
  { valor: "PIX", rotulo: "Pix" },
  { valor: "CARTAO", rotulo: "Cartão" },
];

interface Props {
  valor: FormaPagamento;
  aoMudar: (forma: FormaPagamento) => void;
}

/** Seleção da forma de pagamento, com a mesma cara dos campos de texto. */
export function CampoForma({ valor, aoMudar }: Props) {
  const id = useId();
  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>
        Forma
      </label>
      <select
        id={id}
        className="campo__entrada"
        value={valor}
        onChange={(e) => aoMudar(e.target.value as FormaPagamento)}
      >
        {FORMAS.map((forma) => (
          <option key={forma.valor} value={forma.valor}>
            {forma.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
