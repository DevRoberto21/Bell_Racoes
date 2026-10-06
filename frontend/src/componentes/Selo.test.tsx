import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { rotuloDeAlerta } from "./rotuloDeAlerta";
import { Selo } from "./Selo";

describe("Selo", () => {
  it("rotuloDeAlerta devolve múltiplos de 7 dias", () => {
    expect([1, 2, 3, 4].map(rotuloDeAlerta)).toEqual(["7 dias", "14 dias", "21 dias", "28 dias"]);
  });

  it("nível 0 não renderiza nada", () => {
    const { container } = render(<Selo nivel={0}>7 dias</Selo>);
    expect(container).toBeEmptyDOMElement();
  });

  it("nível 5 usa a classe do nível 3", () => {
    render(<Selo nivel={5}>35 dias</Selo>);
    expect(screen.getByText("35 dias")).toHaveClass("selo--alerta-3");
  });

  it("níveis 1 e 2 usam as suas classes", () => {
    render(
      <>
        <Selo nivel={1}>a</Selo>
        <Selo nivel={2}>b</Selo>
      </>,
    );
    expect(screen.getByText("a")).toHaveClass("selo--alerta-1");
    expect(screen.getByText("b")).toHaveClass("selo--alerta-2");
  });

  it("tipo quitada usa a classe de quitada", () => {
    render(<Selo tipo="quitada">Quitada</Selo>);
    expect(screen.getByText("Quitada")).toHaveClass("selo--quitada");
  });
});
