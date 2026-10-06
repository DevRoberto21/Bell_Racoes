import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { simularMovimentoReduzido } from "../teste/movimento";
import { Dinheiro } from "./Dinheiro";

describe("Dinheiro", () => {
  it("formata o valor da API", () => {
    render(<Dinheiro valor="4812.50" />);
    expect(screen.getByText("R$ 4.812,50")).toBeInTheDocument();
  });

  it("sem animar, trocar o valor troca o texto na hora", () => {
    const { rerender } = render(<Dinheiro valor="10.00" />);
    rerender(<Dinheiro valor="25.90" />);
    expect(screen.getByText("R$ 25,90")).toBeInTheDocument();
  });

  it("com animar, termina exatamente no novo valor", async () => {
    const { rerender } = render(<Dinheiro valor="10.00" animar />);
    expect(screen.getByText("R$ 10,00")).toBeInTheDocument();
    rerender(<Dinheiro valor="4812.50" animar />);
    await waitFor(() => expect(screen.getByText("R$ 4.812,50")).toBeInTheDocument(), { timeout: 2000 });
  });

  it("com animar e movimento reduzido, mostra o valor final na hora", () => {
    const desfazer = simularMovimentoReduzido();
    try {
      const { rerender } = render(<Dinheiro valor="10.00" animar />);
      rerender(<Dinheiro valor="4812.50" animar />);
      expect(screen.getByText("R$ 4.812,50")).toBeInTheDocument();
    } finally {
      desfazer();
    }
  });

  it("com animar e tempo base 0, mostra o valor final na hora, sem NaN", async () => {
    document.documentElement.style.setProperty("--tempo-base", "0s");
    try {
      const { rerender, container } = render(<Dinheiro valor="10.00" animar />);
      rerender(<Dinheiro valor="4812.50" animar />);
      expect(screen.getByText("R$ 4.812,50")).toBeInTheDocument();
      // Alguns quadros depois o texto continua o mesmo: nenhuma contagem ficou rodando.
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(container).toHaveTextContent(/^R\$ 4\.812,50$/);
    } finally {
      document.documentElement.style.removeProperty("--tempo-base");
    }
  });
});
