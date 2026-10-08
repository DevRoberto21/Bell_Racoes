import { NavLink } from "react-router";
import { Botao } from "../../componentes/Botao";
import { useSair, useSessao } from "../sessao/sessao";
import logo from "../../imagens/logo.svg";
import "./Menu.css";

const itens = [
  { rotulo: "Painel", para: "/", exato: true },
  { rotulo: "Clientes", para: "/clientes", exato: false },
  { rotulo: "Contas pagas", para: "/pagas", exato: false },
];

export function Menu() {
  const sessao = useSessao();
  const sair = useSair();
  const usuario = sessao.data?.usuario;

  return (
    <aside className="menu">
      <p className="menu__marca">
        <img className="menu__logo" src={logo} alt="Bell Rações" />
      </p>
      <nav className="menu__navegacao" aria-label="Principal">
        {itens.map((item) => (
          <NavLink
            key={item.para}
            to={item.para}
            end={item.exato}
            className={({ isActive }) => `menu__item${isActive ? " menu__item--ativo" : ""}`}
          >
            {item.rotulo}
          </NavLink>
        ))}
      </nav>
      <div className="menu__rodape">
        <span className="menu__usuario">{usuario?.nome || usuario?.nome_de_usuario}</span>
        <Botao variante="contorno" carregando={sair.isPending} onClick={() => sair.mutate()}>
          Sair
        </Botao>
      </div>
    </aside>
  );
}
