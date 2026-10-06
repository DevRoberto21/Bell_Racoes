const PADRAO_MS = 400;

/** "0.4s" vira 400, "250ms" vira 250; texto vazio ou inválido vira null. */
export function duracaoEmMs(texto: string): number | null {
  const m = /^(\d*\.?\d+)(ms|s)$/.exec(texto.trim());
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2] === "s" ? 1000 : 1));
}

/** O sistema pede menos movimento (`prefers-reduced-motion: reduce`). */
function movimentoReduzido(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Duração das animações feitas em código: lê --tempo-base do documento, para não repetir o número.
 * Com movimento reduzido devolve 0, e quem anima por aqui (inclusive só opacidade) troca de estado na hora.
 */
export function tempoBaseMs(): number {
  if (movimentoReduzido()) return 0;
  const valor = getComputedStyle(document.documentElement).getPropertyValue("--tempo-base");
  return duracaoEmMs(valor) ?? PADRAO_MS;
}
