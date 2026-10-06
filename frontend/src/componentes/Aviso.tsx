import type { ReactNode } from "react";
import "./Aviso.css";

interface Props {
  tipo?: "erro" | "info";
  children: ReactNode;
}

export function Aviso({ tipo = "info", children }: Props) {
  return (
    <div className={`aviso aviso--${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
      {children}
    </div>
  );
}
