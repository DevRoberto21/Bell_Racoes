import { useCallback, useEffect, useRef, type RefObject } from "react";
import { desempilhar, empilhar, estaNoTopo } from "./pilhaDeDialogos";

const FOCAVEIS = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento comum das camadas modais (diálogo e gaveta): entra na pilha enquanto ativa,
 * leva o foco para dentro, prende Tab, fecha com Esc e devolve o foco a quem abriu.
 * Devolve uma função que diz se esta camada é a do topo (para o clique no véu).
 */
export function useCamadaModal(ativa: boolean, caixa: RefObject<HTMLElement | null>, aoFechar: () => void) {
  const identidade = useRef(Symbol("camada"));
  const aoFecharAtual = useRef(aoFechar);
  useEffect(() => {
    aoFecharAtual.current = aoFechar;
  });

  useEffect(() => {
    if (!ativa) return;
    const id = identidade.current;
    const origem = document.activeElement as HTMLElement | null;
    // Ordena pela posição no documento: alguns motores de seletor devolvem na ordem da lista de seletores.
    const focaveis = () =>
      Array.from(caixa.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []).sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
    (focaveis()[0] ?? caixa.current)?.focus();

    empilhar(id);
    const aoTeclar = (e: KeyboardEvent) => {
      if (!estaNoTopo(id)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        aoFecharAtual.current();
        return;
      }
      if (e.key !== "Tab") return;
      const lista = focaveis();
      if (lista.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      const ativo = document.activeElement;
      const fora = !caixa.current?.contains(ativo);
      if (e.shiftKey && (ativo === primeiro || fora)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (ativo === ultimo || fora)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      desempilhar(id);
      origem?.focus();
    };
  }, [ativa, caixa]);

  return useCallback(() => estaNoTopo(identidade.current), []);
}
