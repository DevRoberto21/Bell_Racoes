import type { ReactNode } from "react";
import "./EstadoVazio.css";

export function EstadoVazio({ children }: { children: ReactNode }) {
  return <p className="estado-vazio">{children}</p>;
}
