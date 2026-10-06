import { describe, expect, it } from "vitest";
import { duracaoEmMs, tempoBaseMs } from "./tempo";

describe("duracaoEmMs", () => {
  it("lê segundos e milissegundos", () => {
    expect(duracaoEmMs("0.4s")).toBe(400);
    expect(duracaoEmMs(".4s")).toBe(400);
    expect(duracaoEmMs(" 400ms ")).toBe(400);
  });

  it("devolve null quando vazio ou inválido", () => {
    expect(duracaoEmMs("")).toBeNull();
    expect(duracaoEmMs("abc")).toBeNull();
  });
});

describe("tempoBaseMs", () => {
  it("usa 400 quando a variável não existe", () => {
    expect(tempoBaseMs()).toBe(400);
  });

  it("lê a variável --tempo-base do documento", () => {
    document.documentElement.style.setProperty("--tempo-base", "250ms");
    expect(tempoBaseMs()).toBe(250);
    document.documentElement.style.removeProperty("--tempo-base");
  });
});
