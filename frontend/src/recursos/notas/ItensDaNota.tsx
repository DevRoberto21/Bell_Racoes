import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { formatarQuantidade } from "../../api/numero";
import type { ItemNota } from "../../api/tipos";
import { Dinheiro } from "../../componentes/Dinheiro";
import { tempoBaseMs } from "../../estilo/tempo";
import "./ItensDaNota.css";

interface Props {
  itens: ItemNota[];
  /** Presente só quando a nota permite remover itens. */
  aoRemover?: (item: ItemNota) => void;
  /** Uma gravação da nota está em curso. */
  bloqueado?: boolean;
  /** Linha de novo item, no fim da lista. */
  children?: ReactNode;
}

export function ItensDaNota({ itens, aoRemover, bloqueado = false, children }: Props) {
  const duracao = tempoBaseMs() / 1000;
  return (
    <section className="itens">
      <h3 className="itens__titulo">Itens</h3>
      {itens.length === 0 && <p className="itens__vazio">Nenhum item ainda.</p>}
      {itens.length > 0 && (
        <ul className="itens__lista">
          {/* initial={false}: só o item que chega depois entra animado, não a lista que já veio com a nota. */}
          <AnimatePresence initial={false}>
            {itens.map((item) => (
              <motion.li
                key={item.id}
                className="itens__linha"
                initial={{ opacity: 0, y: "50%" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: duracao, ease: "easeOut" }}
              >
                <span className="itens__descricao">{item.descricao}</span>
                <span className="numero itens__conta">
                  {formatarQuantidade(item.quantidade)} × <Dinheiro valor={item.preco_unitario} />
                </span>
                <span className="itens__subtotal">
                  <Dinheiro valor={item.subtotal} />
                </span>
                {aoRemover && (
                  <button type="button" className="itens__remover" disabled={bloqueado} onClick={() => aoRemover(item)}>
                    Remover
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {children}
    </section>
  );
}
