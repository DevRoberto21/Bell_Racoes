import { afterEach, describe, expect, it } from "vitest";
import { empilhar, desempilhar, estaNoTopo } from "./pilhaDeDialogos";

const A = Symbol("a");
const B = Symbol("b");

afterEach(() => {
  desempilhar(A);
  desempilhar(B);
});

describe("pilhaDeDialogos", () => {
  it("sem ninguém empilhado, ninguém está no topo", () => {
    expect(estaNoTopo(A)).toBe(false);
  });

  it("o último a entrar fica no topo", () => {
    empilhar(A);
    expect(estaNoTopo(A)).toBe(true);
    empilhar(B);
    expect(estaNoTopo(A)).toBe(false);
    expect(estaNoTopo(B)).toBe(true);
  });

  it("ao remover o topo, o de baixo volta ao topo", () => {
    empilhar(A);
    empilhar(B);
    desempilhar(B);
    expect(estaNoTopo(A)).toBe(true);
  });

  it("remover um que está embaixo não muda o topo; remover duas vezes é inofensivo", () => {
    empilhar(A);
    empilhar(B);
    desempilhar(A);
    desempilhar(A);
    expect(estaNoTopo(B)).toBe(true);
  });

  it("empilhar o mesmo duas vezes não o duplica", () => {
    empilhar(A);
    empilhar(A);
    empilhar(B);
    desempilhar(B);
    expect(estaNoTopo(A)).toBe(true);
    desempilhar(A);
    expect(estaNoTopo(A)).toBe(false);
  });
});
