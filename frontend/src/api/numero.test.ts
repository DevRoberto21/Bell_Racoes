import { describe, expect, it } from "vitest";
import { formatarDinheiro, formatarQuantidade, paraDecimal } from "./numero";

describe("paraDecimal", () => {
  it.each([
    ["12", 2, "12.00"],
    ["12,5", 2, "12.50"],
    ["12.5", 2, "12.50"],
    [" 1.234,56 ", 2, "1234.56"],
    ["0,335", 3, "0.335"],
    ["1", 3, "1.000"],
    ["007", 2, "7.00"],
  ])("%s com %i casas vira %s", (texto, casas, esperado) => {
    expect(paraDecimal(texto, casas)).toBe(esperado);
  });

  it.each(["", "abc", "1,2,3", "-5", "1,234", "1e3", "12,", ","])("recusa %s", (texto) => {
    expect(paraDecimal(texto, 2)).toBeNull();
  });

  it("não perde precisão em valores que float erraria", () => {
    expect(paraDecimal("0,1", 2)).toBe("0.10");
    expect(paraDecimal("1234567,89", 2)).toBe("1234567.89");
  });
});

describe("formatarDinheiro", () => {
  it.each([
    ["96.40", "96,40"],
    ["4812.50", "4.812,50"],
    ["1234567.00", "1.234.567,00"],
    ["0.00", "0,00"],
  ])("%s vira %s", (valor, esperado) => {
    expect(formatarDinheiro(valor)).toBe(esperado);
  });
});

describe("formatarQuantidade", () => {
  it.each([
    ["1.000", "1"],
    ["1.500", "1,5"],
    ["0.335", "0,335"],
    ["12.000", "12"],
  ])("%s vira %s", (valor, esperado) => {
    expect(formatarQuantidade(valor)).toBe(esperado);
  });
});
