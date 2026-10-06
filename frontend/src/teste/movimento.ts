import { MotionGlobalConfig } from "motion/react";

/**
 * Simula `prefers-reduced-motion: reduce` com as animações do motion rodando de verdade e um tempo base
 * enorme: o que ainda animar não termina a tempo do teste. Devolve a função que desfaz tudo.
 */
export function simularMovimentoReduzido(): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes("prefers-reduced-motion: reduce"),
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  document.documentElement.style.setProperty("--tempo-base", "60s");
  MotionGlobalConfig.skipAnimations = false;
  return () => {
    window.matchMedia = original;
    document.documentElement.style.removeProperty("--tempo-base");
    MotionGlobalConfig.skipAnimations = true;
  };
}
