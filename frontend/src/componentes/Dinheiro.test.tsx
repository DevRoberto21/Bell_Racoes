import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
