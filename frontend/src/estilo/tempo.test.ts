import { describe, expect, it } from "vitest";
import { simularMovimentoReduzido } from "../teste/movimento";
import { duracaoEmMs, molaBase, tempoBaseMs } from "./tempo";

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

  it("lê 0 quando a variável vale 0s", () => {
    document.documentElement.style.setProperty("--tempo-base", "0s");
    expect(tempoBaseMs()).toBe(0);
    document.documentElement.style.removeProperty("--tempo-base");
  });

  it("com movimento reduzido devolve 0, seja qual for a variável", () => {
    const desfazer = simularMovimentoReduzido();
    try {
      expect(tempoBaseMs()).toBe(0);
    } finally {
      desfazer();
    }
    expect(tempoBaseMs()).toBe(400);
  });
});

describe("molaBase", () => {
  it("é uma mola leve com a duração de --tempo-base, em segundos", () => {
    expect(molaBase()).toEqual({ type: "spring", duration: 0.4, bounce: 0.15 });
    document.documentElement.style.setProperty("--tempo-base", "250ms");
    expect(molaBase()).toEqual({ type: "spring", duration: 0.25, bounce: 0.15 });
    document.documentElement.style.removeProperty("--tempo-base");
  });

  it("com movimento reduzido não há mola: a troca é imediata", () => {
    const desfazer = simularMovimentoReduzido();
    try {
      expect(molaBase()).toEqual({ duration: 0 });
    } finally {
      desfazer();
    }
  });
});
