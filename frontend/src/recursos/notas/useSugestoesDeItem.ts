import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { requisitar } from "../../api/http";

const ESPERA_MS = 150;
const MINIMO_DE_LETRAS = 2;

/** Descrições já lançadas que combinam com o texto; vazio enquanto não há o que sugerir. */
export function useSugestoesDeItem(texto: string): string[] {
  const termo = texto.trim();
  const [espera, setEspera] = useState("");
  useEffect(() => {
    const temporizador = setTimeout(() => setEspera(termo), ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [termo]);

  const consulta = useQuery({
    queryKey: ["sugestoes-de-item", espera],
    queryFn: () =>
      requisitar<{ sugestoes: string[] }>("GET", `/api/itens/sugestoes?q=${encodeURIComponent(espera)}`),
    enabled: espera.length >= MINIMO_DE_LETRAS,
    // Sugestão é ajuda: se a consulta falhar, o campo segue como texto livre.
    retry: false,
  });
  // Enquanto a espera não acabou, o resultado guardado é de outro texto: não mostrar.
  const atual = espera === termo && termo.length >= MINIMO_DE_LETRAS;
  return (atual && consulta.data?.sugestoes) || [];
}
