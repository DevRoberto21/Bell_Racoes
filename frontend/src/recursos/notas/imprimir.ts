/** Abre a página de impressão em outra aba, sem dar a ela acesso à aplicação. */
export function abrirImpressao(url: string): void {
  window.open(url, "_blank", "noopener");
}
