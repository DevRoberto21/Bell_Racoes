import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialogo } from "./Dialogo";

function Exemplo() {
  const [aberto, definirAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => definirAberto(true)}>
        Abrir
      </button>
      <Dialogo aberto={aberto} titulo="Título do diálogo" aoFechar={() => definirAberto(false)}>
        <input aria-label="Primeiro" />
        <button type="button">Último</button>
      </Dialogo>
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

describe("Dialogo", () => {
  it("fechado não renderiza nada", () => {
    render(<Exemplo />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tem papel de diálogo modal, nomeado pelo título", async () => {
    await abrir();
    const dialogo = screen.getByRole("dialog", { name: "Título do diálogo" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
  });

  it("leva o foco para dentro ao abrir", async () => {
    await abrir();
    expect(screen.getByLabelText("Primeiro")).toHaveFocus();
  });

  it("Tab e Shift+Tab ficam dentro do diálogo", async () => {
    const { usuario } = await abrir();
    await usuario.tab();
    expect(screen.getByRole("button", { name: "Último" })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByLabelText("Primeiro")).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Último" })).toHaveFocus();
  });

  it("Esc fecha e devolve o foco a quem abriu", async () => {
    const { usuario, gatilho } = await abrir();
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it("clique no véu fecha; clique dentro do diálogo não", async () => {
    const { usuario, gatilho } = await abrir();
    await usuario.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await usuario.click(screen.getByTestId("veu"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });
});

describe("Dialogo.Confirmacao", () => {
  it("mostra título e mensagem; confirmar chama aoConfirmar e cancelar chama aoFechar", async () => {
    const usuario = userEvent.setup();
    const aoConfirmar = vi.fn();
    const aoFechar = vi.fn();
    render(
      <Dialogo.Confirmacao
        aberto
        titulo="Excluir cliente"
        mensagem="Isto não pode ser desfeito."
        rotuloConfirmar="Excluir"
        aoConfirmar={aoConfirmar}
        aoFechar={aoFechar}
        perigo
      />,
    );
    expect(screen.getByRole("dialog", { name: "Excluir cliente" })).toBeInTheDocument();
    expect(screen.getByText("Isto não pode ser desfeito.")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Excluir" }));
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});

describe("Dialogo.Confirmacao carregando", () => {
  it("com carregando, confirmar fica desabilitado e Esc, cancelar e véu não fecham", async () => {
    const usuario = userEvent.setup();
    const aoFechar = vi.fn();
    render(
      <Dialogo.Confirmacao
        aberto
        carregando
        titulo="Excluir cliente"
        mensagem="Certeza?"
        rotuloConfirmar="Excluir"
        aoConfirmar={() => {}}
        aoFechar={aoFechar}
      />,
    );
    expect(screen.getByRole("button", { name: "Excluir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await usuario.keyboard("{Escape}");
    await usuario.click(screen.getByTestId("veu"));
    expect(aoFechar).not.toHaveBeenCalled();
  });
});

function Empilhado() {
  const [baixo, definirBaixo] = useState(true);
  const [alto, definirAlto] = useState(false);
  return (
    <>
      <Dialogo aberto={baixo} titulo="Diálogo de baixo" aoFechar={() => definirBaixo(false)}>
        <button type="button" onClick={() => definirAlto(true)}>
          Abrir confirmação
        </button>
        <button type="button">Botão de baixo</button>
      </Dialogo>
      <Dialogo.Confirmacao
        aberto={alto}
        titulo="Confirmar de cima"
        mensagem="Certeza?"
        rotuloConfirmar="Sim"
        aoConfirmar={() => {}}
        aoFechar={() => definirAlto(false)}
      />
    </>
  );
}

describe("Dialogo empilhado", () => {
  async function abrirConfirmacao() {
    const usuario = userEvent.setup();
    render(<Empilhado />);
    const gatilho = screen.getByRole("button", { name: "Abrir confirmação" });
    await usuario.click(gatilho);
    return { usuario, gatilho };
  }

  it("o primeiro Esc fecha só a confirmação; o segundo fecha o diálogo de baixo", async () => {
    const { usuario } = await abrirConfirmacao();
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Confirmar de cima" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Diálogo de baixo" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Tab dentro do de cima nunca leva o foco ao de baixo", async () => {
    const { usuario } = await abrirConfirmacao();
    const de = screen.getByRole("dialog", { name: "Confirmar de cima" });
    for (let i = 0; i < 4; i++) {
      await usuario.tab();
      expect(de).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 4; i++) {
      await usuario.tab({ shift: true });
      expect(de).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("ao fechar o de cima, o foco volta ao elemento do de baixo que o abriu", async () => {
    const { usuario, gatilho } = await abrirConfirmacao();
    await usuario.keyboard("{Escape}");
    expect(gatilho).toHaveFocus();
  });
});
