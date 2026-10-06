import type { ReactNode } from "react";
import "./Lista.css";

function Item({ onAbrir, children }: { onAbrir: () => void; children: ReactNode }) {
  return (
    <li className="lista__item">
      <button type="button" className="lista__linha" onClick={onAbrir}>
        {children}
      </button>
    </li>
  );
}

export function Lista({ children }: { children: ReactNode }) {
  return <ul className="lista">{children}</ul>;
}

Lista.Item = Item;
