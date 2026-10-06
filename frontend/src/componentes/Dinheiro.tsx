import { useEffect, useRef, useState } from "react";
import { formatarDinheiro } from "../api/numero";
import { tempoBaseMs } from "../estilo/tempo";

interface Props {
  valor: string;
  animar?: boolean;
}

/** "96.40" vira 9640n, só com texto: nunca passa por float de reais. */
function paraCentavos(valor: string): bigint {
  const [inteira, decimal = ""] = valor.split(".");
  return BigInt(inteira + decimal.padEnd(2, "0").slice(0, 2));
}

function deCentavos(centavos: bigint): string {
  const texto = centavos.toString().padStart(3, "0");
  return `${texto.slice(0, -2)}.${texto.slice(-2)}`;
}

export function Dinheiro({ valor, animar = false }: Props) {
  const [exibido, setExibido] = useState(() => paraCentavos(valor));
  const atual = useRef(exibido);
  // Duração 0 (movimento reduzido, ou --tempo-base zerado): não há contagem, o valor aparece direto.
  const duracao = animar ? tempoBaseMs() : 0;
  const direto = duracao === 0;

  useEffect(() => {
    if (direto) return;
    const origem = atual.current;
    const destino = paraCentavos(valor);
    if (origem === destino) return;
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const progresso = Math.min((agora - inicio) / duracao, 1);
      const suave = 1 - (1 - progresso) ** 3;
      const proximo =
        progresso >= 1 ? destino : origem + (destino - origem) * BigInt(Math.round(suave * 1000)) / 1000n;
      atual.current = proximo;
      setExibido(proximo);
      if (progresso < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, direto, duracao]);

  const texto = direto ? valor : deCentavos(exibido);
  return <span className="numero">R$ {formatarDinheiro(texto)}</span>;
}
