import { useEffect, useRef } from "react";

/** Teclas que não são letra: valem também com o foco num campo. */
const VALEM_EM_CAMPO = new Set(["f2", "escape"]);

function focoEmCampo(): boolean {
  const ativo = document.activeElement;
  if (!(ativo instanceof HTMLElement)) return false;
  return ativo.matches("input, textarea, select") || ativo.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/**
 * Atalho de teclado da tela: ouve `keydown` na janela enquanto o componente está montado.
 * Ignora a tecla com ctrl, meta ou alt, com `ativo` falso e, para atalhos de letra, com o foco num campo.
 * Quando dispara, cancela a ação padrão da tecla (a "/" não chega a ser digitada no campo que recebe o foco).
 */
export function useAtalho(tecla: string, acao: () => void, opcoes: { ativo?: boolean } = {}) {
  const ativo = opcoes.ativo ?? true;
  const acaoAtual = useRef(acao);
  useEffect(() => {
    acaoAtual.current = acao;
  });

  useEffect(() => {
    if (!ativo) return;
    const esperada = tecla.toLowerCase();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
      if (evento.key.toLowerCase() !== esperada) return;
      if (!VALEM_EM_CAMPO.has(esperada) && focoEmCampo()) return;
      evento.preventDefault();
      acaoAtual.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [tecla, ativo]);
}
