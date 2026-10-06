import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClienteDetalhe } from "../api/tipos";
import { Dialogo } from "../componentes/Dialogo";
import { Gaveta } from "../componentes/Gaveta";
import { Busca } from "../recursos/busca/Busca";
import { TelaCliente } from "../recursos/clientes/TelaCliente";
import { GavetaDaNota } from "../recursos/notas/GavetaDaNota";
import { ACOES_FECHADA, adiado, notaDeTeste, simularFetch } from "../teste/notas";
import { renderizarComApp, responder } from "../teste/renderizar";
import { useAtalho } from "./atalhos";

function Ouvinte({ tecla, acao, ativo }: { tecla: string; acao: () => void; ativo?: boolean }) {
  useAtalho(tecla, acao, { ativo });
  return (
    <>
      <input aria-label="Campo" />
      <textarea aria-label="Texto" />
      <select aria-label="Escolha">
        <option>Um</option>
      </select>
      <div aria-label="Editável" contentEditable suppressContentEditableWarning tabIndex={0} />
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useAtalho", () => {
  it("dispara fora de campo, com a letra em maiúscula ou minúscula", async () => {
    const acao = vi.fn();
    render(<Ouvinte tecla="n" acao={acao} />);
    await userEvent.keyboard("n");
    await userEvent.keyboard("N");
    expect(acao).toHaveBeenCalledTimes(2);
  });

  it("não dispara com outra tecla", async () => {
    const acao = vi.fn();
    render(<Ouvinte tecla="n" acao={acao} />);
    await userEvent.keyboard("r");
    expect(acao).not.toHaveBeenCalled();
  });

  it("não dispara dentro de input, textarea, select ou elemento editável", async () => {
    const acao = vi.fn();
    render(<Ouvinte tecla="n" acao={acao} />);
    for (const rotulo of ["Campo", "Texto", "Escolha", "Editável"]) {
      screen.getByLabelText(rotulo).focus();
      await userEvent.keyboard("n");
    }
    expect(acao).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Campo")).toHaveValue("n");
  });

  it("não dispara com ctrl, meta ou alt", async () => {
    const acao = vi.fn();
    render(<Ouvinte tecla="n" acao={acao} />);
    await userEvent.keyboard("{Control>}n{/Control}");
    await userEvent.keyboard("{Meta>}n{/Meta}");
    await userEvent.keyboard("{Alt>}n{/Alt}");
    expect(acao).not.toHaveBeenCalled();
  });

  it("F2 e Escape disparam também dentro de input", async () => {
    const f2 = vi.fn();
    const esc = vi.fn();
    render(
      <>
        <Ouvinte tecla="F2" acao={f2} />
        <Ouvinte tecla="Escape" acao={esc} />
      </>,
    );
    screen.getAllByLabelText("Campo")[0].focus();
    await userEvent.keyboard("{F2}{Escape}");
    expect(f2).toHaveBeenCalledTimes(1);
    expect(esc).toHaveBeenCalledTimes(1);
  });

  it("com ativo: false não dispara", async () => {
    const acao = vi.fn();
    render(<Ouvinte tecla="n" acao={acao} ativo={false} />);
    await userEvent.keyboard("n");
    expect(acao).not.toHaveBeenCalled();
  });

  it("para de ouvir quando o componente sai da tela", async () => {
    const acao = vi.fn();
    const { unmount } = render(<Ouvinte tecla="n" acao={acao} />);
    unmount();
    await userEvent.keyboard("n");
    expect(acao).not.toHaveBeenCalled();
  });
});

describe("atalhos da busca", () => {
  const busca = () => screen.getByRole("combobox", { name: "Busca rápida" });

  it("/ foca a busca sem digitar a barra no campo", async () => {
    renderizarComApp(<Busca />);
    expect(busca()).not.toHaveFocus();
    await userEvent.keyboard("/");
    expect(busca()).toHaveFocus();
    expect(busca()).toHaveValue("");
  });

  it("com o foco já num campo, / é digitada normalmente", async () => {
    renderizarComApp(
      <>
        <Busca />
        <input aria-label="Outro campo" />
      </>,
    );
    const outro = screen.getByLabelText("Outro campo");
    await userEvent.type(outro, "1/2");
    expect(outro).toHaveValue("1/2");
    expect(outro).toHaveFocus();
  });

  it("F2 foca a busca mesmo com o foco em outro campo", async () => {
    renderizarComApp(
      <>
        <Busca />
        <input aria-label="Outro campo" />
      </>,
    );
    screen.getByLabelText("Outro campo").focus();
    await userEvent.keyboard("{F2}");
    expect(busca()).toHaveFocus();
  });

  it("com um diálogo aberto, / e F2 não tiram o foco de dentro dele", async () => {
    renderizarComApp(
      <>
        <Busca />
        <Dialogo.Confirmacao aberto titulo="Excluir" mensagem="Excluir?" rotuloConfirmar="Excluir" aoConfirmar={() => {}} aoFechar={() => {}} />
      </>,
    );
    await userEvent.keyboard("/{F2}");
    expect(busca()).not.toHaveFocus();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });
});

describe("atalho N na tela do cliente", () => {
  const cliente: ClienteDetalhe = {
    codigo: 12,
    codigo_formatado: "12",
    nome: "José Pereira",
    apelido: "Zé",
    telefone: "",
    divida: "0.00",
    notas_abertas: 0,
    notas: [],
    tem_continua_aberta: false,
    pode_excluir: true,
  };
  const CRIAR = "POST /api/clientes/12/notas";

  function tela(extra?: React.ReactNode) {
    const api = simularFetch((chave) => {
      if (chave === "GET /api/clientes/12") return responder(cliente);
      if (chave === CRIAR) return responder(notaDeTeste({ codigo: "12-01" }), 201);
      return undefined;
    });
    renderizarComApp(
      <>
        <Routes>
          <Route path="/clientes/:codigo" element={<TelaCliente />} />
        </Routes>
        {extra}
      </>,
      { rota: "/clientes/12" },
    );
    return api;
  }

  it("cria uma nota única e abre a gaveta dela", async () => {
    const api = tela();
    await screen.findByRole("heading", { name: /José Pereira/ });
    await userEvent.keyboard("n");
    await waitFor(() => expect(screen.getByTestId("local")).toHaveTextContent("/clientes/12?nota=12-01"));
    expect(api.corpoDe(CRIAR)).toEqual({ tipo: "UNICA" });
    expect(api.quantas(CRIAR)).toBe(1);
  });

  it("antes de o cliente carregar não faz nada", async () => {
    const espera = adiado();
    const api = simularFetch((chave) => (chave === "GET /api/clientes/12" ? espera.promessa.then(() => responder(cliente)) : undefined));
    renderizarComApp(
      <Routes>
        <Route path="/clientes/:codigo" element={<TelaCliente />} />
      </Routes>,
      { rota: "/clientes/12" },
    );
    await userEvent.keyboard("n");
    espera.liberar();
    await screen.findByRole("heading", { name: /José Pereira/ });
    expect(api.quantas(CRIAR)).toBe(0);
  });

  it("com um diálogo aberto não cria nota", async () => {
    const api = tela();
    await userEvent.click(await screen.findByRole("button", { name: "Excluir cliente" }));
    // O foco fica num botão do diálogo, não num campo: o que barra o atalho é o diálogo aberto.
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement?.tagName).toBe("BUTTON");
    await userEvent.keyboard("n");
    expect(api.quantas(CRIAR)).toBe(0);
  });

  it("com uma gaveta aberta não cria nota", async () => {
    const api = tela(
      <Gaveta aberta titulo="Nota 12-01" aoFechar={() => {}}>
        <p>Conteúdo</p>
      </Gaveta>,
    );
    await screen.findByRole("heading", { name: /José Pereira/ });
    await userEvent.keyboard("n");
    expect(api.quantas(CRIAR)).toBe(0);
  });
});

describe("atalho R na gaveta da nota", () => {
  const GET_NOTA = "GET /api/notas/1-1";
  const formulario = () => screen.queryByRole("form", { name: "Receber pagamento" });

  function abrir(rotas: (chave: string) => unknown) {
    const api = simularFetch(rotas);
    renderizarComApp(<GavetaDaNota />, { rota: "/?nota=01-01" });
    return api;
  }

  it("abre Receber quando a nota aceita pagamento", async () => {
    abrir((chave) => (chave === GET_NOTA ? responder(notaDeTeste()) : undefined));
    await screen.findByRole("button", { name: "Receber" });
    await userEvent.keyboard("R");
    expect(formulario()).toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toHaveValue("160,00");
  });

  it("não abre quando a nota não tem a ação receber", async () => {
    abrir((chave) => (chave === GET_NOTA ? responder(notaDeTeste({ acoes: { ...ACOES_FECHADA, receber: false } })) : undefined));
    await screen.findByRole("button", { name: "Reimprimir" });
    await userEvent.keyboard("r");
    expect(formulario()).not.toBeInTheDocument();
  });

  it("não abre enquanto uma gravação da nota está pendente", async () => {
    const espera = adiado();
    abrir((chave) => {
      if (chave === GET_NOTA) return responder(notaDeTeste({ tipo: "CONTINUA", situacao: "ABERTA", acoes: { ...ACOES_FECHADA, fechar: true } }));
      if (chave === "POST /api/notas/1-1/fechar") return espera.promessa.then(() => responder(notaDeTeste()));
      return undefined;
    });
    await userEvent.click(await screen.findByRole("button", { name: "Fechar nota" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Receber" })).toBeDisabled());
    await userEvent.keyboard("r");
    expect(formulario()).not.toBeInTheDocument();
    espera.liberar();
    await waitFor(() => expect(screen.getByRole("button", { name: "Receber" })).toBeEnabled());
  });

  it("não abre com uma confirmação por cima da gaveta", async () => {
    abrir((chave) =>
      chave === GET_NOTA
        ? responder(notaDeTeste({ tipo: "CONTINUA", situacao: "ABERTA", acoes: { ...ACOES_FECHADA, descartar: true } }))
        : undefined,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("dialog", { name: "Descartar nota" })).toBeInTheDocument();
    await userEvent.keyboard("r");
    expect(formulario()).not.toBeInTheDocument();
  });

  it("em Correção, R não troca o modo", async () => {
    abrir((chave) => (chave === GET_NOTA ? responder(notaDeTeste()) : undefined));
    await userEvent.click(await screen.findByRole("button", { name: "Correção" }));
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("r");
    expect(formulario()).not.toBeInTheDocument();
  });
});
