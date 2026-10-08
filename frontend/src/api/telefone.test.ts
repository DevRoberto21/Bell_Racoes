import { describe, expect, it } from "vitest";
import { formatarTelefone, telefoneValido } from "./telefone";

describe("formatarTelefone", () => {
  it.each([
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11)9"],
    ["1191234", "(11)91234"],
    ["11912345", "(11)91234-5"],
    ["11912345678", "(11)91234-5678"],
    ["119123456789", "(11)91234-5678"],
    ["+55 11 91234-5678", "(11)91234-5678"],
    ["abc", ""],
    ["(11)91234-5678", "(11)91234-5678"],
  ])("%j vira %j", (entrada, esperado) => {
    expect(formatarTelefone(entrada)).toBe(esperado);
  });
});

describe("telefoneValido", () => {
  it("aceita celular completo, com ou sem máscara", () => {
    expect(telefoneValido("(11)91234-5678")).toBe(true);
    expect(telefoneValido("11912345678")).toBe(true);
  });

  it.each(["", "(11)91234-567", "(01)91234-5678", "(11)81234-5678", "(11)3123-4567"])("recusa %j", (texto) => {
    expect(telefoneValido(texto)).toBe(false);
  });
});
