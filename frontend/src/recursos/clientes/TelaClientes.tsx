import { useState } from "react";
import { useNavigate } from "react-router";
import { Botao } from "../../componentes/Botao";
import { Dialogo } from "../../componentes/Dialogo";
import { Dinheiro } from "../../componentes/Dinheiro";
import { EstadoVazio } from "../../componentes/EstadoVazio";
import { FalhaDeConsulta } from "../../componentes/FalhaDeConsulta";
import { Lista } from "../../componentes/Lista";
import { useTitulo } from "../estrutura/titulo";
import { useClientes, useCriarCliente } from "./clientes";
import { FormularioCliente } from "./FormularioCliente";
import "./TelaClientes.css";

export function TelaClientes() {
  useTitulo("Clientes");
  const [filtro, setFiltro] = useState("");
  const [criando, setCriando] = useState(false);
  const clientes = useClientes(filtro);
  const criar = useCriarCliente();
  const navegar = useNavigate();

  return (
    <section className="clientes">
      <header className="clientes__topo">
        <h1 className="clientes__titulo">Clientes</h1>
        <Botao onClick={() => setCriando(true)}>Novo cliente</Botao>
      </header>
      <div className="clientes__filtro">
        <label className="clientes__rotulo" htmlFor="filtro-clientes">
          Filtrar por nome ou apelido
        </label>
        <input
          id="filtro-clientes"
          type="search"
          className="clientes__entrada"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && filtro) {
              e.preventDefault();
              setFiltro("");
            }
          }}
        />
      </div>
      {clientes.isError && (
        <FalhaDeConsulta erro={clientes.error} mensagem="Não foi possível carregar os clientes." aoTentar={() => void clientes.refetch()} />
      )}
      {clientes.data &&
        (clientes.data.length === 0 ? (
          <EstadoVazio>Nenhum cliente encontrado.</EstadoVazio>
        ) : (
          <Lista>
            {clientes.data.map((c) => (
              <Lista.Item key={c.codigo} onAbrir={() => navegar(`/clientes/${c.codigo}`)}>
                <span className="numero clientes__codigo">{c.codigo_formatado}</span>
                <span className="clientes__nome">{c.nome}</span>
                <span className="clientes__apoio">{c.apelido}</span>
                <span className="clientes__apoio">
                  {c.notas_abertas} {c.notas_abertas === 1 ? "nota" : "notas"}
                </span>
                <span className="clientes__valor">
                  <Dinheiro valor={c.divida} />
                </span>
              </Lista.Item>
            ))}
          </Lista>
        ))}
      <Dialogo aberto={criando} titulo="Novo cliente" aoFechar={() => setCriando(false)}>
        <FormularioCliente
          rotuloEnviar="Criar cliente"
          aoCancelar={() => setCriando(false)}
          aoEnviar={async (dados) => {
            const novo = await criar.mutateAsync(dados);
            setCriando(false);
            navegar(`/clientes/${novo.codigo}`);
          }}
        />
      </Dialogo>
    </section>
  );
}
