import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Botao } from "./Botao";
import { desempilhar, empilhar, estaNoTopo } from "./pilhaDeDialogos";
import "./Dialogo.css";

const FOCAVEIS = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

interface Props {
  aberto: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
}

export function Dialogo({ aberto, titulo, aoFechar, children }: Props) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const identidade = useRef(Symbol("dialogo"));
  const aoFecharAtual = useRef(aoFechar);
  useEffect(() => {
    aoFecharAtual.current = aoFechar;
  });

  useEffect(() => {
    if (!aberto) return;
    const id = identidade.current;
    const origem = document.activeElement as HTMLElement | null;
    // Ordena pela posição no documento: alguns motores de seletor devolvem na ordem da lista de seletores.
    const focaveis = () =>
      Array.from(caixa.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []).sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
    (focaveis()[0] ?? caixa.current)?.focus();

    empilhar(id);
    const aoTeclar = (e: KeyboardEvent) => {
      if (!estaNoTopo(id)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        aoFecharAtual.current();
        return;
      }
      if (e.key !== "Tab") return;
      const lista = focaveis();
      if (lista.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      const ativo = document.activeElement;
      const fora = !caixa.current?.contains(ativo);
      if (e.shiftKey && (ativo === primeiro || fora)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (ativo === ultimo || fora)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      desempilhar(id);
      origem?.focus();
    };
  }, [aberto]);

  if (!aberto) return null;
  return createPortal(
    <div
      className="dialogo__veu"
      data-testid="veu"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget || !estaNoTopo(identidade.current)) return;
        // Sem isto o navegador move o foco para o corpo da página depois do fechamento, perdendo o retorno ao gatilho.
        e.preventDefault();
        aoFechar();
      }}
    >
      <div ref={caixa} className="dialogo" role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}>
        <h2 className="dialogo__titulo" id={idTitulo}>
          {titulo}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface PropsConfirmacao {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  rotuloConfirmar: string;
  aoConfirmar: () => void;
  aoFechar: () => void;
  perigo?: boolean;
  /** Enquanto verdadeiro, confirmar fica desabilitado e nada fecha o diálogo. */
  carregando?: boolean;
}

function Confirmacao({ aberto, titulo, mensagem, rotuloConfirmar, aoConfirmar, aoFechar, perigo, carregando = false }: PropsConfirmacao) {
  return (
    <Dialogo aberto={aberto} titulo={titulo} aoFechar={carregando ? () => {} : aoFechar}>
      <p className="dialogo__mensagem">{mensagem}</p>
      <div className="dialogo__acoes">
        <Botao variante="contorno" onClick={aoFechar} disabled={carregando}>
          Cancelar
        </Botao>
        <Botao variante={perigo ? "perigo" : "principal"} onClick={aoConfirmar} carregando={carregando}>
          {rotuloConfirmar}
        </Botao>
      </div>
    </Dialogo>
  );
}

Dialogo.Confirmacao = Confirmacao;
