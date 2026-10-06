import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { requisitar } from "../../api/http";
import type { ResultadoBusca } from "../../api/tipos";

const ESPERA_MS = 150;

export function useBusca(termo: string) {
  const limpo = termo.trim();
  const [espera, setEspera] = useState(limpo);
  useEffect(() => {
    if (!limpo) return;
    const temporizador = setTimeout(() => setEspera(limpo), ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [limpo]);

  const consulta = useQuery({
    queryKey: ["busca", espera],
    queryFn: () => requisitar<ResultadoBusca>("GET", `/api/busca?q=${encodeURIComponent(espera)}`),
    enabled: limpo !== "" && espera !== "",
  });
  // Enquanto a espera não acabou, o resultado guardado é de outro texto: não mostrar.
  const atual = limpo !== "" && espera === limpo;
  return { data: atual ? consulta.data : undefined, isError: atual && consulta.isError };
}
