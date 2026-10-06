import type { ReactNode } from "react";
import "./Lista.css";

interface PropsDoItem {
  onAbrir: () => void;
  /** Ação própria da linha (um botão), ao lado dela: fica fora do botão que abre. */
  acao?: ReactNode;
  children: ReactNode;
}

function Item({ onAbrir, acao, children }: PropsDoItem) {
  return (
    <li className="lista__item">
      <button type="button" className="lista__linha" onClick={onAbrir}>
        {children}
      </button>
      {acao}
    </li>
  );
}

export function Lista({ children }: { children: ReactNode }) {
  return <ul className="lista">{children}</ul>;
}

Lista.Item = Item;
