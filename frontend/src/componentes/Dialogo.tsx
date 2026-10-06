import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Botao } from "./Botao";
import { useCamadaModal } from "./useCamadaModal";
import "./Dialogo.css";

interface Props {
  aberto: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
}

export function Dialogo({ aberto, titulo, aoFechar, children }: Props) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const noTopo = useCamadaModal(aberto, caixa, aoFechar);

  if (!aberto) return null;
  return createPortal(
    <div
      className="dialogo__veu"
      data-testid="veu"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget || !noTopo()) return;
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
