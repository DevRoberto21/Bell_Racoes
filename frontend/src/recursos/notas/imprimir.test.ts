import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirImpressao } from "./imprimir";

afterEach(() => vi.restoreAllMocks());

describe("abrirImpressao", () => {
  it("abre o endereço em outra aba, sem vínculo com a aplicação", () => {
    const abrir = vi.spyOn(window, "open").mockReturnValue(null);
    abrirImpressao("/notas/1-3/imprimir");
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith("/notas/1-3/imprimir", "_blank", "noopener");
  });
});
