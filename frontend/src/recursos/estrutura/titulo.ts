import { useEffect } from "react";

const MARCA = "Bell Rações";

/** Título da aba: "<tela> · Bell Rações"; sem nome de tela (ainda carregando), só a marca. */
export function useTitulo(tela?: string) {
  useEffect(() => {
    document.title = tela ? `${tela} · ${MARCA}` : MARCA;
  }, [tela]);
}
