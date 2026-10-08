import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { Menu } from "./Menu";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Menu", () => {
  it("mostra a logo da loja como imagem chamada Bell Rações", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(responder({ usuario: { nome_de_usuario: "caixa1", nome: "Flávia" } })),
    );
    renderizarComApp(<Menu />);
    expect(screen.getByRole("img", { name: "Bell Rações" })).toBeInTheDocument();
  });
});
