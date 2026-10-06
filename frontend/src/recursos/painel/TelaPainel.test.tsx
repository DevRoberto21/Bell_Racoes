import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotaResumo, Painel } from "../../api/tipos";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { TelaPainel } from "./TelaPainel";

function nota(codigo: string, extra: Partial<NotaResumo> = {}): NotaResumo {
  return {
    codigo,
    cliente: { codigo: 12, codigo_formatado: "12", nome: "José Pereira" },
    numero: 3,
    tipo: "UNICA",
    tipo_rotulo: "Única",
    situacao: "ABERTA",
    situacao_rotulo: "Aberta",
    criada_em: "2026-09-10T10:00:00Z",
    quitada_em: null,
    editada: false,
    dias_em_aberto: 23,
    nivel_alerta: 3,
    total: "100.00",
    saldo: "96.40",
    ...extra,
  };
}

function painel(extra: Partial<Painel> = {}): Painel {
  return {
    total_em_aberto: "4812.50",
    alertas: [nota("12-03")],
    rascunhos: [nota("12-04", { situacao: "RASCUNHO", nivel_alerta: 0, dias_em_aberto: 0 })],
    backup_falhou: false,
    ...extra,
  };
}

function simular(dados: Painel) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responder(dados)));
}

afterEach(() => vi.unstubAllGlobals());

describe("TelaPainel", () => {
  it("mostra o total, uma linha por alerta com selo e a seção de rascunhos", async () => {
    simular(painel());
    renderizarComApp(<TelaPainel />);
    expect(await screen.findByText("R$ 4.812,50")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(screen.getByText("Fiado em aberto")).toBeInTheDocument();
    expect(screen.getByText("21 dias")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /12-03/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rascunhos não finalizados" })).toBeInTheDocument();
  });

  it("sem rascunhos não mostra a seção; sem alertas mostra a mensagem vazia", async () => {
    simular(painel({ alertas: [], rascunhos: [] }));
    renderizarComApp(<TelaPainel />);
    expect(await screen.findByText("Nenhuma nota atrasada.")).toBeInTheDocument();
    expect(screen.queryByText("Rascunhos não finalizados")).not.toBeInTheDocument();
  });

  it("mostra o aviso quando a cópia de segurança falhou", async () => {
    simular(painel({ backup_falhou: true }));
    renderizarComApp(<TelaPainel />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A cópia de segurança de hoje não foi feita. Confira a pasta de cópias e avise o responsável.",
    );
  });

  it("clicar numa linha põe ?nota=<codigo> no endereço", async () => {
    simular(painel());
    renderizarComApp(<TelaPainel />);
    await userEvent.click(await screen.findByRole("button", { name: /12-03/ }));
    expect(screen.getByTestId("local")).toHaveTextContent("/?nota=12-03");
  });

  it("define o título da aba", async () => {
    simular(painel());
    renderizarComApp(<TelaPainel />);
    await waitFor(() => expect(document.title).toBe("Painel · Bell Rações"));
  });

  it("falha de rede mostra o aviso com Tentar de novo, que busca outra vez", async () => {
    const fetchSimulado = vi.fn().mockRejectedValueOnce(new TypeError("sem rede")).mockResolvedValue(responder(painel()));
    vi.stubGlobal("fetch", fetchSimulado);
    renderizarComApp(<TelaPainel />);
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("Sem conexão com o servidor.");
    await userEvent.click(within(aviso).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("R$ 4.812,50")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
