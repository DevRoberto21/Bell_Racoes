import { useQuery } from "@tanstack/react-query";
import { requisitar } from "../../api/http";
import type { Painel } from "../../api/tipos";

export function usePainel() {
  return useQuery({
    queryKey: ["painel"],
    queryFn: () => requisitar<Painel>("GET", "/api/painel"),
  });
}
