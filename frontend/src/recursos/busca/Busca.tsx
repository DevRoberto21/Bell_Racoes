import { useId, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { Dinheiro } from "../../componentes/Dinheiro";
import { useAbrirNota } from "../notas/abrirNota";
import { useBusca } from "./useBusca";
import "./Busca.css";

interface Opcao {
  chave: string;
  destino: { cliente: number } | { nota: string };
  codigo: string;
  nome: string;
  valor: string;
  detalhe?: string;
}

export function Busca() {
  const [texto, setTexto] = useState("");
  const [aberta, setAberta] = useState(true);
  const [indice, setIndice] = useState(0);
  const idLista = useId();
  const navegar = useNavigate();
  const abrirNota = useAbrirNota();
  const consulta = useBusca(texto);

  const resultado = texto.trim() ? consulta.data : undefined;
  const opcoes: Opcao[] = [];
  let mensagem: string | null = null;
  if (resultado?.tipo === "nota") {
    const n = resultado.nota;
    opcoes.push({ chave: n.codigo, destino: { nota: n.codigo }, codigo: n.codigo, nome: n.cliente.nome, valor: n.saldo });
  } else if (resultado?.tipo === "cliente") {
    const c = resultado.cliente;
    opcoes.push({ chave: `c${c.codigo}`, destino: { cliente: c.codigo }, codigo: c.codigo_formatado, nome: c.nome, valor: c.divida });
    for (const n of c.notas) {
      opcoes.push({
        chave: n.codigo,
        destino: { nota: n.codigo },
        codigo: n.codigo,
        nome: `${n.tipo_rotulo} · ${n.dias_em_aberto} dias`,
        valor: n.saldo,
        detalhe: "nota",
      });
    }
  } else if (resultado?.tipo === "lista") {
    if (resultado.clientes.length === 0) mensagem = "Nenhum cliente encontrado.";
    for (const c of resultado.clientes) {
      opcoes.push({ chave: `c${c.codigo}`, destino: { cliente: c.codigo }, codigo: c.codigo_formatado, nome: c.nome, valor: c.divida });
    }
  } else if (resultado?.tipo === "nao_encontrado") {
    mensagem = resultado.mensagem;
  }

  const visivel = aberta && texto.trim() !== "";
  const ativo = Math.min(indice, opcoes.length - 1);

  function abrir(opcao: Opcao) {
    setTexto("");
    setIndice(0);
    setAberta(false);
    if ("cliente" in opcao.destino) navegar(`/clientes/${opcao.destino.cliente}`);
    else abrirNota(opcao.destino.nota);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      setAberta(false);
    } else if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setAberta(true);
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      setIndice(Math.max(0, Math.min(ativo + passo, opcoes.length - 1)));
    } else if (evento.key === "Enter" && visivel && opcoes.length > 0) {
      evento.preventDefault();
      abrir(opcoes[ativo]);
    }
  }

  return (
    <div className="busca">
      <input
        type="search"
        className="busca__campo"
        role="combobox"
        aria-label="Busca rápida"
        aria-expanded={visivel && opcoes.length > 0}
        aria-controls={idLista}
        aria-activedescendant={visivel && opcoes.length > 0 ? `${idLista}-${ativo}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Código (12 ou 12-03) ou nome"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberta(true);
          setIndice(0);
        }}
        onKeyDown={aoTeclar}
        onBlur={() => setAberta(false)}
        onFocus={() => setAberta(true)}
      />
      {visivel && (opcoes.length > 0 || mensagem || consulta.isError) && (
        <div className="busca__resultados">
          {opcoes.length > 0 && (
            <ul className="busca__lista" role="listbox" id={idLista}>
              {opcoes.map((opcao, i) => (
                <li
                  key={opcao.chave}
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={i === ativo}
                  className={`busca__opcao${opcao.detalhe ? " busca__opcao--nota" : ""}${i === ativo ? " busca__opcao--ativa" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setIndice(i)}
                  onClick={() => abrir(opcao)}
                >
                  <span className="numero busca__codigo">{opcao.codigo}</span>
                  <span className="busca__nome">{opcao.nome}</span>
                  <Dinheiro valor={opcao.valor} />
                </li>
              ))}
            </ul>
          )}
          {mensagem && <p className="busca__mensagem" role="status">{mensagem}</p>}
          {consulta.isError && <p className="busca__mensagem" role="status">Não foi possível buscar agora.</p>}
        </div>
      )}
    </div>
  );
}
