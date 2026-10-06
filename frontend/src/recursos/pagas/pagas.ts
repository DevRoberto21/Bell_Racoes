import { useQuery } from "@tanstack/react-query";
import { requisitar } from "../../api/http";
import type { NotaResumo } from "../../api/tipos";

/** Notas quitadas nos últimos 7 dias. */
export function usePagas() {
  return useQuery({
    queryKey: ["pagas"],
    queryFn: () => requisitar<NotaResumo[]>("GET", "/api/pagas"),
  });
}
