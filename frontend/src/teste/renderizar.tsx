import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { LocalAtual } from "./LocalAtual";

/** Renderiza com um QueryClient novo e um MemoryRouter; `local` mostra o endereço atual. */
export function renderizarComApp(ui: ReactElement, opcoes: { rota?: string } = {}) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[opcoes.rota ?? "/"]}>
        {ui}
        <LocalAtual />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function responder(corpo: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => corpo };
}
