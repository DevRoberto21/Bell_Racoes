import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClienteDetalhe } from "../../api/tipos";
import { Rotas } from "../../rotas";
import { notaDeTeste, simularFetch } from "../../teste/notas";
import { renderizarComApp, responder } from "../../teste/renderizar";

const usuario = { nome_de_usuario: "caixa1", nome: "Flávia" };
const semLogin = () => responder({ erro: "Entre para continuar." }, 401);

const cliente: ClienteDetalhe = {
  codigo: 12,
  codigo_formatado: "12",
  nome: "José Pereira",
  apelido: "",
  telefone: "",
  divida: "160.00",
  notas_abertas: 1,
  notas: [],
  tem_continua_aberta: false,
  pode_excluir: false,
};

const local = () => screen.getByTestId("local");

async function entrar() {
  await userEvent.type(await screen.findByLabelText("Usuário"), "caixa1");
  await userEvent.type(screen.getByLabelText("Senha"), "segredo");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("sessão expirada", () => {
  it("401 numa consulta leva para /entrar com o endereço atual, e o login volta para ele", async () => {
    // A tela acredita que há sessão (cache de /api/sessao), mas o servidor já não a reconhece.
    let logado = false;
    const api = simularFetch((chave) => {
      if (chave === "GET /api/sessao") return responder({ usuario });
      if (chave === "POST /api/entrar") {
        logado = true;
        return responder({ usuario });
      }
      if (!logado) return semLogin();
      if (chave === "GET /api/clientes/12") return responder(cliente);
      if (chave === "GET /api/notas/12-3") return responder(notaDeTeste({ codigo: "12-03" }));
      return undefined;
    });
    renderizarComApp(<Rotas />, { rota: "/clientes/12?nota=12-03" });

    // Cliente e nota respondem 401 ao mesmo tempo: um redirecionamento só, sem laço.
    await waitFor(() => expect(local()).toHaveTextContent("/entrar?depois=%2Fclientes%2F12%3Fnota%3D12-03"));
    expect(local().textContent).toBe("/entrar?depois=%2Fclientes%2F12%3Fnota%3D12-03");
    expect(api.quantas("GET /api/clientes/12")).toBeGreaterThan(0);
    expect(api.quantas("GET /api/notas/12-3")).toBeGreaterThan(0);

    await entrar();
    await waitFor(() => expect(local().textContent).toBe("/clientes/12?nota=12-03"));
    expect(await screen.findByRole("heading", { name: /José Pereira/ }, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Nota 12-03" })).toBeInTheDocument();
    expect(local().textContent).toBe("/clientes/12?nota=12-03");
  });

  it("401 numa gravação também leva para /entrar", async () => {
    const api = simularFetch((chave) => {
      if (chave === "GET /api/sessao") return responder({ usuario });
      if (chave === "GET /api/clientes/12") return responder(cliente);
      if (chave === "POST /api/clientes/12/notas") return semLogin();
      return undefined;
    });
    renderizarComApp(<Rotas />, { rota: "/clientes/12" });
    await userEvent.click(await screen.findByRole("button", { name: "Nova nota única" }));
    await waitFor(() => expect(local().textContent).toBe("/entrar?depois=%2Fclientes%2F12"));
    expect(api.quantas("POST /api/clientes/12/notas")).toBe(1);
  });

  it("sem sessão desde o início, /api/sessao com usuário nulo já leva para /entrar", async () => {
    simularFetch((chave) => (chave === "GET /api/sessao" ? responder({ usuario: null }) : undefined));
    renderizarComApp(<Rotas />, { rota: "/pagas" });
    await waitFor(() => expect(local().textContent).toBe("/entrar?depois=%2Fpagas"));
  });

  it("senha errada (erro do próprio /api/entrar) fica em /entrar, com o endereço de volta intacto", async () => {
    simularFetch((chave) => {
      if (chave === "GET /api/sessao") return responder({ usuario: null });
      if (chave === "POST /api/entrar") return responder({ erro: "Usuário ou senha incorretos." }, 401);
      return undefined;
    });
    renderizarComApp(<Rotas />, { rota: "/entrar?depois=%2Fpagas" });
    await entrar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Usuário ou senha incorretos.");
    expect(local().textContent).toBe("/entrar?depois=%2Fpagas");
    expect(screen.getByLabelText("Usuário")).toHaveValue("caixa1");
  });
});
