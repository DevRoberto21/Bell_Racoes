import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionGlobalConfig } from "motion/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Dialogo } from "./Dialogo";
import { Gaveta } from "./Gaveta";

function Exemplo() {
  const [aberta, definirAberta] = useState(false);
  const [confirmando, definirConfirmando] = useState(false);
  return (
    <>
      <button type="button" onClick={() => definirAberta(true)}>
        Abrir
      </button>
      <Gaveta
        aberta={aberta}
        titulo="Nota 01-03"
        aoFechar={() => definirAberta(false)}
        rodape={<button type="button">Último</button>}
      >
        <input aria-label="Campo" />
        <button type="button" onClick={() => definirConfirmando(true)}>
          Descartar
        </button>
      </Gaveta>
      <Dialogo.Confirmacao
        aberto={confirmando}
        titulo="Descartar nota"
        mensagem="Certeza?"
        rotuloConfirmar="Sim"
        aoConfirmar={() => {}}
        aoFechar={() => definirConfirmando(false)}
      />
    </>
  );
}

async function abrir() {
  const usuario = userEvent.setup();
  render(<Exemplo />);
  const gatilho = screen.getByRole("button", { name: "Abrir" });
  await usuario.click(gatilho);
  return { usuario, gatilho };
}

const gaveta = () => screen.queryByRole("dialog", { name: "Nota 01-03" });
const sumiu = () => waitFor(() => expect(gaveta()).not.toBeInTheDocument());

// As animações terminam na hora: os testes não dependem do tempo de saída da gaveta.
beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

describe("Gaveta", () => {
  it("fechada não renderiza nada", () => {
    render(<Exemplo />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("é um diálogo modal nomeado pelo título, com rodapé", async () => {
    await abrir();
    expect(gaveta()).toHaveAttribute("aria-modal", "true");
    expect(gaveta()).toContainElement(screen.getByRole("button", { name: "Último" }));
  });

  it("leva o foco para dentro ao abrir", async () => {
    await abrir();
    expect(gaveta()).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
  });

  it("Tab e Shift+Tab ficam dentro da gaveta", async () => {
    const { usuario } = await abrir();
    await usuario.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Último" })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    for (let i = 0; i < 6; i++) {
      await usuario.tab();
      expect(gaveta()).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("Esc fecha e devolve o foco a quem abriu", async () => {
    const { usuario, gatilho } = await abrir();
    await usuario.keyboard("{Escape}");
    await sumiu();
    expect(gatilho).toHaveFocus();
  });

  it("o botão Fechar fecha", async () => {
    const { usuario } = await abrir();
    await usuario.click(screen.getByRole("button", { name: "Fechar" }));
    await sumiu();
  });

  it("clique dentro não fecha; clique no véu fecha e devolve o foco", async () => {
    const { usuario, gatilho } = await abrir();
    await usuario.click(screen.getByRole("heading", { name: "Nota 01-03" }));
    await usuario.click(screen.getByLabelText("Campo"));
    expect(gaveta()).toBeInTheDocument();
    await usuario.click(screen.getByTestId("veu-gaveta"));
    await sumiu();
    expect(gatilho).toHaveFocus();
  });

  it("com uma confirmação por cima, o primeiro Esc fecha só a confirmação", async () => {
    const { usuario } = await abrir();
    const descartar = screen.getByRole("button", { name: "Descartar" });
    await usuario.click(descartar);
    expect(screen.getByRole("dialog", { name: "Descartar nota" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Descartar nota" })).not.toBeInTheDocument();
    expect(gaveta()).toBeInTheDocument();
    expect(descartar).toHaveFocus();
    await usuario.keyboard("{Escape}");
    await sumiu();
  });

  it("com uma confirmação por cima, clique no véu da gaveta não a fecha", async () => {
    const { usuario } = await abrir();
    await usuario.click(screen.getByRole("button", { name: "Descartar" }));
    await usuario.click(screen.getByTestId("veu-gaveta"));
    expect(gaveta()).toBeInTheDocument();
  });
});
