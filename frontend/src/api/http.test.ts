import { afterEach, describe, expect, it, vi } from "vitest";
import { aoExpirarSessao, ErroApi, requisitar } from "./http";

function resposta(status: number, corpo?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (corpo === undefined) throw new SyntaxError("sem json");
      return corpo;
    },
  };
}

function simular(valor: unknown) {
  const fetchSimulado = vi.fn().mockResolvedValue(valor);
  vi.stubGlobal("fetch", fetchSimulado);
  return fetchSimulado;
}

async function rejeicao(promessa: Promise<unknown>): Promise<ErroApi> {
  try {
    await promessa;
  } catch (erro) {
    return erro as ErroApi;
  }
  throw new Error("A requisição deveria ter sido rejeitada.");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requisitar", () => {
  it("faz GET com cookies da mesma origem e devolve o JSON", async () => {
    const fetchSimulado = simular(resposta(200, { total: "1.00" }));
    await expect(requisitar("GET", "/api/painel")).resolves.toEqual({ total: "1.00" });
    expect(fetchSimulado).toHaveBeenCalledWith("/api/painel", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  });

  it("envia JSON e o token CSRF do cookie no POST", async () => {
    document.cookie = "csrftoken=abc123";
    const fetchSimulado = simular(resposta(200, {}));
    await requisitar("POST", "/api/x", { a: 1 });
    const [, opcoes] = fetchSimulado.mock.calls[0];
    expect(opcoes.method).toBe("POST");
    expect(opcoes.body).toBe('{"a":1}');
    expect(opcoes.headers["Content-Type"]).toBe("application/json");
    expect(opcoes.headers["X-CSRFToken"]).toBe("abc123");
  });

  it("rejeita 409 com ErroApi carregando a mensagem da API", async () => {
    simular(resposta(409, { erro: "Mudou.", campos: {} }));
    const falha = await rejeicao(requisitar("POST", "/api/x", {}));
    expect(falha).toBeInstanceOf(ErroApi);
    expect(falha.status).toBe(409);
    expect(falha.message).toBe("Mudou.");
  });

  it("expõe os campos de um 400", async () => {
    simular(resposta(400, { erro: "Dados inválidos.", campos: { nome: "Obrigatório." } }));
    const falha = await rejeicao(requisitar("POST", "/api/x", {}));
    expect(falha.campos).toEqual({ nome: "Obrigatório." });
  });

  it("transforma um 500 sem JSON em ErroApi", async () => {
    simular(resposta(500));
    const falha = await rejeicao(requisitar("GET", "/api/x"));
    expect(falha).toBeInstanceOf(ErroApi);
    expect(falha.status).toBe(500);
    expect(falha.message).toBe("O servidor não respondeu como esperado.");
  });

  it("transforma falha de rede em ErroApi de status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const falha = await rejeicao(requisitar("GET", "/api/x"));
    expect(falha).toBeInstanceOf(ErroApi);
    expect(falha.status).toBe(0);
    expect(falha.message).toBe("Sem conexão com o servidor.");
  });

  it("avisa quem ouve a sessão quando a resposta é 401, com ou sem JSON", async () => {
    const ouvinte = vi.fn();
    const cancelar = aoExpirarSessao(ouvinte);
    simular(resposta(401, { erro: "Entre para continuar." }));
    const falha = await rejeicao(requisitar("GET", "/api/painel"));
    expect(falha.status).toBe(401);
    expect(ouvinte).toHaveBeenCalledTimes(1);

    simular(resposta(401));
    await rejeicao(requisitar("POST", "/api/notas/1-1/fechar", {}));
    expect(ouvinte).toHaveBeenCalledTimes(2);

    cancelar();
    await rejeicao(requisitar("GET", "/api/painel"));
    expect(ouvinte).toHaveBeenCalledTimes(2);
  });

  it("401 de /api/sessao e de /api/entrar não conta como sessão expirada", async () => {
    const ouvinte = vi.fn();
    const cancelar = aoExpirarSessao(ouvinte);
    simular(resposta(401, { erro: "Usuário ou senha incorretos." }));
    await rejeicao(requisitar("POST", "/api/entrar", {}));
    await rejeicao(requisitar("GET", "/api/sessao"));
    expect(ouvinte).not.toHaveBeenCalled();
    cancelar();
  });

  it("outros erros não avisam a sessão", async () => {
    const ouvinte = vi.fn();
    const cancelar = aoExpirarSessao(ouvinte);
    simular(resposta(409, { erro: "Mudou." }));
    await rejeicao(requisitar("POST", "/api/x", {}));
    expect(ouvinte).not.toHaveBeenCalled();
    cancelar();
  });
});
