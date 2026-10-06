import type { ButtonHTMLAttributes } from "react";
import "./Botao.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "principal" | "contorno" | "perigo";
  carregando?: boolean;
}

export function Botao({ variante = "principal", carregando = false, disabled, className, children, ...resto }: Props) {
  const classes = ["botao", `botao--${variante}`, className].filter(Boolean).join(" ");
  return (
    <button type="button" {...resto} className={classes} disabled={disabled || carregando} aria-busy={carregando || undefined}>
      {children}
    </button>
  );
}
