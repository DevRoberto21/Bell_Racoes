const PADRAO_MS = 400;

/** "0.4s" vira 400, "250ms" vira 250; texto vazio ou inválido vira null. */
export function duracaoEmMs(texto: string): number | null {
  const m = /^(\d*\.?\d+)(ms|s)$/.exec(texto.trim());
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2] === "s" ? 1000 : 1));
}

/** Lê --tempo-base do documento, para não repetir o número no código. */
export function tempoBaseMs(): number {
  const valor = getComputedStyle(document.documentElement).getPropertyValue("--tempo-base");
  return duracaoEmMs(valor) ?? PADRAO_MS;
}
