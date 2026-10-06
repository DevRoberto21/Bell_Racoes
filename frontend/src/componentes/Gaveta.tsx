import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { tempoBaseMs } from "../estilo/tempo";
import { useCamadaModal } from "./useCamadaModal";
import "./Gaveta.css";

interface Props {
  aberta: boolean;
  titulo: string;
  aoFechar: () => void;
  rodape?: ReactNode;
  children: ReactNode;
}

/** Painel lateral direito, modal, na mesma pilha dos diálogos. */
export function Gaveta({ aberta, titulo, aoFechar, rodape, children }: Props) {
  const idTitulo = useId();
  const painel = useRef<HTMLDivElement>(null);
  const noTopo = useCamadaModal(aberta, painel, aoFechar);
  const duracao = tempoBaseMs() / 1000;

  return createPortal(
    <AnimatePresence>
      {aberta && (
        <motion.div
          key="veu"
          className="gaveta__veu"
          data-testid="veu-gaveta"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duracao, ease: "easeOut" }}
          onMouseDown={(e) => {
            if (!noTopo()) return;
            // Sem isto o navegador move o foco para o corpo da página depois do fechamento, perdendo o retorno ao gatilho.
            e.preventDefault();
            aoFechar();
          }}
        />
      )}
      {aberta && (
        <motion.div
          key="painel"
          ref={painel}
          className="gaveta"
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitulo}
          tabIndex={-1}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", duration: duracao, bounce: 0.15 }}
        >
          <header className="gaveta__cabecalho">
            <h2 className="gaveta__titulo" id={idTitulo}>
              {titulo}
            </h2>
            <button type="button" className="gaveta__fechar" aria-label="Fechar" onClick={aoFechar}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className="gaveta__corpo">{children}</div>
          {rodape && <footer className="gaveta__rodape">{rodape}</footer>}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
