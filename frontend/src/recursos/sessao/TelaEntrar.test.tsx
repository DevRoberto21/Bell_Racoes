import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TelaEntrar } from "./TelaEntrar";

function Destino() {
  const local = useLocation();
  return <p>Chegou em {local.pathname}</p>;
}

function montar(endereco = "/entrar") {
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[endereco]}>
        <Routes>
          <Route path="/entrar" element={<TelaEntrar />} />
          <Route path="*" element={<Destino />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function responder(status: number, corpo: unknown) {
  return { ok: status < 300, status, json: async () => corpo };
}

function simularEntradaAceita() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(responder(200, { usuario: { nome_de_usuario: "caixa1", nome: "Flávia" } })),
  );
}

async function entrar() {
  await userEvent.type(screen.getByLabelText("Usuário"), "caixa1");
  await userEvent.type(screen.getByLabelText("Senha"), "x");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TelaEntrar", () => {
  it("mostra os campos Usuário e Senha e o botão Entrar", () => {
    montar();
    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("envia usuário e senha e navega para a raiz", async () => {
    const fetchSimulado = vi
      .fn()
      .mockResolvedValue(responder(200, { usuario: { nome_de_usuario: "caixa1", nome: "Flávia" } }));
    vi.stubGlobal("fetch", fetchSimulado);
    montar();
    await userEvent.type(screen.getByLabelText("Usuário"), "caixa1");
    await userEvent.type(screen.getByLabelText("Senha"), " teste-1 ");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Chegou em /")).toBeInTheDocument();
    const [caminho, opcoes] = fetchSimulado.mock.calls[0];
    expect(caminho).toBe("/api/entrar");
    expect(opcoes.method).toBe("POST");
    expect(JSON.parse(opcoes.body)).toEqual({ usuario: "caixa1", senha: " teste-1 " });
  });

  it("navega para o caminho de ?depois= quando existe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(responder(200, { usuario: { nome_de_usuario: "caixa1", nome: "Flávia" } })),
    );
    montar("/entrar?depois=/clientes/3");
    await userEvent.type(screen.getByLabelText("Usuário"), "caixa1");
    await userEvent.type(screen.getByLabelText("Senha"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Chegou em /clientes/3")).toBeInTheDocument();
  });

  it("aceita o destino em ?next=, que é como o servidor redireciona", async () => {
    simularEntradaAceita();
    montar("/entrar?next=/clientes/3");
    await entrar();
    expect(await screen.findByText("Chegou em /clientes/3")).toBeInTheDocument();
  });

  it.each(["/notas/1-1/imprimir/", "/recibos/7/", "/recibos/lote/00000000-0000-0000-0000-000000000001/"])(
    "destino do servidor (%s) carrega a página inteira em vez de navegar no roteador",
    async (destino) => {
      const atribuir = vi.fn();
      vi.stubGlobal("location", { ...window.location, assign: atribuir });
      simularEntradaAceita();
      montar(`/entrar?next=${encodeURIComponent(destino)}`);
      await entrar();
      await waitFor(() => expect(atribuir).toHaveBeenCalledWith(destino));
      expect(screen.queryByText(/Chegou em/)).not.toBeInTheDocument();
    },
  );

  it.each([
    ["outro site com duas barras", "//evil.com"],
    ["outro site com barra invertida", "/\\evil.com"],
    ["endereço completo", "https://evil.com"],
    ["caminho sem barra inicial", "clientes"],
    ["outro site escondido atrás de uma tabulação", "/\t/evil.com"],
    ["outro site escondido atrás de uma quebra de linha", "/\n/evil.com"],
  ])("recusa %s e vai para a raiz", async (_caso, destino) => {
    const atribuir = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign: atribuir });
    simularEntradaAceita();
    montar(`/entrar?next=${encodeURIComponent(destino)}`);
    await entrar();
    expect(await screen.findByText("Chegou em /")).toBeInTheDocument();
    expect(atribuir).not.toHaveBeenCalled();
  });

  it("recusa destino do servidor disfarçado com barra invertida", async () => {
    const atribuir = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign: atribuir });
    simularEntradaAceita();
    montar(`/entrar?depois=${encodeURIComponent("/\\notas/evil.com")}`);
    await entrar();
    expect(await screen.findByText("Chegou em /")).toBeInTheDocument();
    expect(atribuir).not.toHaveBeenCalled();
  });

  it("mostra o erro da API e mantém o usuário digitado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(responder(400, { erro: "Usuário ou senha incorretos.", campos: {} })),
    );
    montar();
    await userEvent.type(screen.getByLabelText("Usuário"), "caixa1");
    await userEvent.type(screen.getByLabelText("Senha"), "errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Usuário ou senha incorretos.");
    expect(screen.getByLabelText("Usuário")).toHaveValue("caixa1");
  });

  it("desabilita o botão enquanto a requisição está em andamento", async () => {
    let concluir: (valor: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise((resolver) => (concluir = resolver))),
    );
    montar();
    await userEvent.type(screen.getByLabelText("Usuário"), "caixa1");
    await userEvent.type(screen.getByLabelText("Senha"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Entrar/ })).toBeDisabled());
    concluir(responder(200, { usuario: { nome_de_usuario: "caixa1", nome: "F" } }));
    expect(await screen.findByText("Chegou em /")).toBeInTheDocument();
  });

  it("falha de rede mostra o aviso e mantém o que foi digitado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    montar();
    await userEvent.type(screen.getByLabelText("Usuário"), "caixa1");
    await userEvent.type(screen.getByLabelText("Senha"), "segredo");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão com o servidor.");
    expect(screen.getByLabelText("Usuário")).toHaveValue("caixa1");
    expect(screen.getByLabelText("Senha")).toHaveValue("segredo");
  });
});
