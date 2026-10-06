import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotaResumo } from "../../api/tipos";
import { notaDeTeste, simularFetch } from "../../teste/notas";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { TelaPagas } from "./TelaPagas";

function paga(codigo: string, extra: Partial<NotaResumo> = {}): NotaResumo {
  return {
    codigo,
    cliente: { codigo: 1, codigo_formatado: "01", nome: "Maria" },
    numero: Number(codigo.split("-")[1]),
    tipo: "UNICA",
    tipo_rotulo: "Única",
    situacao: "QUITADA",
    situacao_rotulo: "Quitada",
    criada_em: "2026-09-28T12:00:00-03:00",
    quitada_em: "2026-10-03T12:00:00-03:00",
    editada: false,
    dias_em_aberto: 5,
    nivel_alerta: 0,
    total: "160.00",
    saldo: "0.00",
    ...extra,
  };
}

const PAGAS = "GET /api/pagas";
const duas = () => [
  paga("01-01"),
  paga("12-03", {
    cliente: { codigo: 12, codigo_formatado: "12", nome: "José Pereira" },
    tipo: "CONTINUA",
    tipo_rotulo: "Contínua",
    quitada_em: "2026-10-01T12:00:00-03:00",
    total: "96.40",
  }),
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TelaPagas", () => {
  it("mostra o título, a explicação e uma linha por nota com código, cliente, tipo, data da quitação e total", async () => {
    simularFetch((chave) => (chave === PAGAS ? responder(duas()) : undefined));
    renderizarComApp(<TelaPagas />, { rota: "/pagas" });

    expect(screen.getByRole("heading", { name: "Contas pagas" })).toBeInTheDocument();
    expect(
      screen.getByText("Notas quitadas nos últimos 7 dias. As mais antigas continuam guardadas e abrem pelo código na busca."),
    ).toBeInTheDocument();

    const linhas = await screen.findAllByRole("listitem");
    expect(linhas).toHaveLength(2);
    const primeira = within(linhas[0]).getByRole("button", { name: /01-01/ });
    expect(primeira).toHaveTextContent("Maria");
    expect(primeira).toHaveTextContent("Única");
    expect(primeira).toHaveTextContent("03/10/2026");
    expect(primeira).toHaveTextContent("R$ 160,00");
    const segunda = within(linhas[1]).getByRole("button", { name: /12-03/ });
    expect(segunda).toHaveTextContent("José Pereira");
    expect(segunda).toHaveTextContent("Contínua");
    expect(segunda).toHaveTextContent("01/10/2026");
    expect(segunda).toHaveTextContent("R$ 96,40");
    expect(screen.getAllByRole("button", { name: "Reimprimir" })).toHaveLength(2);
  });

  it("define o título da aba", async () => {
    simularFetch((chave) => (chave === PAGAS ? responder([]) : undefined));
    renderizarComApp(<TelaPagas />, { rota: "/pagas" });
    await waitFor(() => expect(document.title).toBe("Contas pagas · Bell Rações"));
  });

  it("sem notas mostra a mensagem vazia", async () => {
    simularFetch((chave) => (chave === PAGAS ? responder([]) : undefined));
    renderizarComApp(<TelaPagas />, { rota: "/pagas" });
    expect(await screen.findByText("Nenhuma nota quitada nos últimos 7 dias.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("clicar na linha abre a gaveta da nota, sem imprimir", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    simularFetch((chave) => (chave === PAGAS ? responder(duas()) : undefined));
    renderizarComApp(<TelaPagas />, { rota: "/pagas" });
    await userEvent.click(await screen.findByRole("button", { name: /12-03/ }));
    expect(screen.getByTestId("local")).toHaveTextContent("/pagas?nota=12-03");
    expect(abrirJanela).not.toHaveBeenCalled();
  });

  it("Reimprimir chama window.open com o imprimir_url da nota, sem abrir a gaveta", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const api = simularFetch((chave) => {
      if (chave === PAGAS) return responder(duas());
      if (chave === "GET /api/notas/12-3") return responder(notaDeTeste({ codigo: "12-03", imprimir_url: "/notas/12-3/imprimir/" }));
      return undefined;
    });
    renderizarComApp(<TelaPagas />, { rota: "/pagas" });
    const linhas = await screen.findAllByRole("listitem");
    await userEvent.click(within(linhas[1]).getByRole("button", { name: "Reimprimir" }));

    await waitFor(() => expect(abrirJanela).toHaveBeenCalledWith("/notas/12-3/imprimir/", "_blank", "noopener"));
    expect(abrirJanela).toHaveBeenCalledTimes(1);
    expect(api.quantas("GET /api/notas/12-3")).toBe(1);
    expect(screen.getByTestId("local")).toHaveTextContent(/^\/pagas$/);
  });

  it("falha ao buscar a nota para reimprimir mostra o aviso e não abre janela", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    simularFetch((chave) => {
      if (chave === PAGAS) return responder(duas());
      if (chave === "GET /api/notas/1-1") return Promise.reject(new TypeError("sem rede"));
      return undefined;
    });
    renderizarComApp(<TelaPagas />, { rota: "/pagas" });
    const linhas = await screen.findAllByRole("listitem");
    await userEvent.click(within(linhas[0]).getByRole("button", { name: "Reimprimir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão com o servidor.");
    expect(abrirJanela).not.toHaveBeenCalled();
  });

  it("falha de rede mostra o aviso com Tentar de novo, que busca outra vez", async () => {
    let fora = true;
    const api = simularFetch((chave) => {
      if (chave !== PAGAS) return undefined;
      return fora ? Promise.reject(new TypeError("sem rede")) : responder(duas());
    });
    renderizarComApp(<TelaPagas />, { rota: "/pagas" });

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("Sem conexão com o servidor.");
    fora = false;
    await userEvent.click(within(aviso).getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("button", { name: /01-01/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.quantas(PAGAS)).toBe(2);
  });

  it("erro do servidor mostra a mensagem da tela, sem Tentar de novo", async () => {
    simularFetch((chave) => (chave === PAGAS ? responder({ erro: "Falhou." }, 500) : undefined));
    renderizarComApp(<TelaPagas />, { rota: "/pagas" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar as contas pagas.");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });
});
