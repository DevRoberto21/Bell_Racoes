import { useCallback } from "react";
import { useSearchParams } from "react-router";

/** Abre a nota escrevendo ?nota=12-03 e preservando o resto do endereço. */
export function useAbrirNota(): (codigo: string) => void {
  const [, definir] = useSearchParams();
  return useCallback(
    (codigo: string) =>
      definir((atuais) => {
        const novos = new URLSearchParams(atuais);
        novos.set("nota", codigo);
        return novos;
      }),
    [definir],
  );
}

export function useNotaAberta(): string | null {
  const [parametros] = useSearchParams();
  return parametros.get("nota");
}
