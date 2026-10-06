import { Outlet } from "react-router";
import { Busca } from "../busca/Busca";
import { GavetaDaNota } from "../notas/GavetaDaNota";
import { Menu } from "./Menu";
import "./Estrutura.css";

export function Estrutura() {
  return (
    <div className="estrutura">
      <Menu />
      <div className="estrutura__area">
        <header className="estrutura__topo">
          <Busca />
        </header>
        <main className="estrutura__conteudo">
          <Outlet />
        </main>
      </div>
      <GavetaDaNota />
    </div>
  );
}
