import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ErroApi } from "../../api/http";
import type { TipoNota } from "../../api/tipos";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { Dialogo } from "../../componentes/Dialogo";
import { Dinheiro } from "../../componentes/Dinheiro";
import { EstadoVazio } from "../../componentes/EstadoVazio";
import { Lista } from "../../componentes/Lista";
import { Selo } from "../../componentes/Selo";
import { useAbrirNota } from "../notas/abrirNota";
import { useCliente, useCriarNota, useEditarCliente, useExcluirCliente } from "./clientes";
import { FormularioCliente } from "./FormularioCliente";
import { PagarDivida } from "./PagarDivida";
import "./TelaCliente.css";

export function TelaCliente() {
  const { codigo = "" } = useParams();
  const navegar = useNavigate();
  const abrirNota = useAbrirNota();
  const cliente = useCliente(codigo);
  const criarNota = useCriarNota(codigo);
  const editar = useEditarCliente(codigo);
  const excluir = useExcluirCliente(codigo);
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const excluido = useRef(false);
  const limparAtual = useRef(excluir.limpar);
  useEffect(() => {
    limparAtual.current = excluir.limpar;
  });
  // Só depois que a tela saiu do ar (a navegação já aconteceu) o cache do cliente excluído é descartado.
  useEffect(
    () => () => {
      if (excluido.current) void limparAtual.current();
    },
    [],
  );

  if (cliente.error instanceof ErroApi && cliente.error.status === 404) {
    return (
      <section className="cliente">
        <p>Cliente não encontrado.</p>
        <Link to="/clientes">Voltar para a lista de clientes</Link>
      </section>
    );
  }
  if (cliente.isError) return <Aviso tipo="erro">Não foi possível carregar o cliente.</Aviso>;
  if (!cliente.data) return null;
  const c = cliente.data;

  const mensagem = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir a ação.");

  function novaNota(tipo: TipoNota) {
    setFalha(null);
    criarNota.mutate(tipo, {
      onSuccess: (nota) => abrirNota(nota.codigo),
      onError: (e) => setFalha(mensagem(e)),
    });
  }

  const temRascunho = c.notas.some((n) => n.situacao === "RASCUNHO");

  return (
    <section className="cliente">
      <header className="cliente__cabecalho">
        <h1 className="cliente__titulo">
          {c.codigo_formatado} · {c.nome}
          {c.apelido ? ` (${c.apelido})` : ""}
        </h1>
        {c.telefone && <p className="cliente__apoio">{c.telefone}</p>}
        <p className="cliente__divida">
          <span className="cliente__apoio">Dívida</span>
          <strong>
            <Dinheiro valor={c.divida} animar />
          </strong>
        </p>
      </header>

      {falha && <Aviso tipo="erro">{falha}</Aviso>}

      <div className="cliente__acoes">
        <Botao onClick={() => novaNota("UNICA")} disabled={criarNota.isPending}>
          Nova nota única
        </Botao>
        <Botao
          variante="contorno"
          onClick={() => novaNota("CONTINUA")}
          disabled={c.tem_continua_aberta || criarNota.isPending}
          title={c.tem_continua_aberta ? "Já existe uma nota contínua aberta" : undefined}
        >
          Nova nota contínua
        </Botao>
        {c.divida !== "0.00" && (
          <Botao variante="contorno" onClick={() => setPagando(true)}>
            Pagar dívida total
          </Botao>
        )}
        <Botao variante="contorno" onClick={() => setEditando(true)}>
          Editar cadastro
        </Botao>
        {c.pode_excluir && (
          <Botao variante="perigo" onClick={() => setExcluindo(true)}>
            Excluir cliente
          </Botao>
        )}
      </div>

      <h2 className="cliente__secao">Notas em aberto</h2>
      {c.notas.length === 0 ? (
        <EstadoVazio>Nenhuma nota em aberto.</EstadoVazio>
      ) : (
        <Lista>
          {c.notas.map((n) => (
            <Lista.Item key={n.codigo} onAbrir={() => abrirNota(n.codigo)}>
              <span className="numero cliente__codigo">{n.codigo}</span>
              <span>{n.tipo_rotulo}</span>
              <span className="cliente__apoio">{n.situacao_rotulo}</span>
              {n.editada && <Selo tipo="editado">Editado</Selo>}
              {n.situacao === "RASCUNHO" && <Selo tipo="rascunho">Rascunho</Selo>}
              <span className="cliente__apoio cliente__espaco">{n.dias_em_aberto} dias</span>
              <span className="cliente__valor">
                <Dinheiro valor={n.saldo} />
              </span>
            </Lista.Item>
          ))}
        </Lista>
      )}
      {temRascunho && (
        <p className="cliente__apoio">Rascunho ainda não é dívida: só entra na conta depois de finalizado.</p>
      )}

      <Dialogo aberto={editando} titulo="Editar cadastro" aoFechar={() => setEditando(false)}>
        <FormularioCliente
          inicial={{ nome: c.nome, apelido: c.apelido, telefone: c.telefone }}
          rotuloEnviar="Salvar"
          aoCancelar={() => setEditando(false)}
          aoEnviar={async (dados) => {
            await editar.mutateAsync(dados);
            setEditando(false);
          }}
        />
      </Dialogo>

      <PagarDivida cliente={c} aberto={pagando} aoFechar={() => setPagando(false)} />

      <Dialogo.Confirmacao
        aberto={excluindo}
        titulo="Excluir cliente"
        mensagem={`Excluir ${c.nome}? Isto não pode ser desfeito.`}
        rotuloConfirmar="Excluir"
        perigo
        carregando={excluir.isPending}
        aoFechar={() => setExcluindo(false)}
        aoConfirmar={() =>
          excluir.mutate(undefined, {
            onSuccess: () => {
              excluido.current = true;
              navegar("/clientes");
            },
            onError: (e) => {
              setExcluindo(false);
              setFalha(mensagem(e));
            },
          })
        }
      />
    </section>
  );
}
