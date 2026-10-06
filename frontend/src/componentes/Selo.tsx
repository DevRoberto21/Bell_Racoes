import type { ReactNode } from "react";
import "./Selo.css";

type Props =
  | { nivel: number; tipo?: undefined; children: ReactNode }
  | { tipo: "quitada" | "editado" | "rascunho"; nivel?: undefined; children: ReactNode };

export function Selo({ nivel, tipo, children }: Props) {
  if (tipo === undefined && nivel <= 0) return null;
  const variante = tipo ?? `alerta-${Math.min(nivel, 3)}`;
  return <span className={`selo selo--${variante}`}>{children}</span>;
}
