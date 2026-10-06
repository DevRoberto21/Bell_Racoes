import { useId, type InputHTMLAttributes } from "react";
import "./Campo.css";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string;
}

export function Campo({ rotulo, erro, id, className, ...resto }: Props) {
  const gerado = useId();
  const idCampo = id ?? gerado;
  const idErro = `${idCampo}-erro`;
  return (
    <div className={["campo", className].filter(Boolean).join(" ")}>
      <label className="campo__rotulo" htmlFor={idCampo}>
        {rotulo}
      </label>
      <input
        {...resto}
        id={idCampo}
        className="campo__entrada"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
      />
      {erro && (
        <p className="campo__erro" id={idErro}>
          {erro}
        </p>
      )}
    </div>
  );
}
