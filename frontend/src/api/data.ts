/** "2026-10-01T12:00:00-03:00" vira "01/10/2026", no fuso do computador. */
export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
