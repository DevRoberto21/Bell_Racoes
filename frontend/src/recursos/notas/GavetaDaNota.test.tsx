import { useQuery } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AcoesDaNota, Nota } from "../../api/tipos";
import { simularMovimentoReduzido } from "../../teste/movimento";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { GavetaDaNota } from "./GavetaDaNota";

const NENHUMA: AcoesDaNota = {
  adicionar_item: false,
  remover_item: false,
  finalizar: false,
  fechar: false,
  descartar: false,
  receber: false,
  corrigir: false,
  imprimir: false,
};
const RASCUNHO: AcoesDaNota = { ...NENHUMA, adicionar_item: true, remover_item: true, finalizar: true, descartar: true };
const CONTINUA_ABERTA: AcoesDaNota = {
  ...NENHUMA,
  adicionar_item: true,
  fechar: true,
  receber: true,
  corrigir: true,
  imprimir: true,
};
const FECHADA: AcoesDaNota = { ...NENHUMA, receber: true, corrigir: true, imprimir: true };
const QUITADA: AcoesDaNota = { ...NENHUMA, imprimir: true };

function nota(extras: Partial<Nota> = {}): Nota {
  return {
    codigo: "01-01",
    cliente: { codigo: 1, codigo_formatado: "01", nome: "Maria" },
    numero: 1,
    tipo: "UNICA",
    tipo_rotulo: "Única",
    situacao: "RASCUNHO",
    situacao_rotulo: "Rascunho",
    criada_em: "2026-09-28T12:00:00-03:00",
    quitada_em: null,
    editada: false,
    dias_em_aberto: 3,
    nivel_alerta: 0,
    total: "60.00",
    saldo: "60.00",
    editada_em: null,
    versao: 4,
    total_pago: "0.00",
    itens: [{ id: 7, descricao: "Ração 15kg", quantidade: "1.500", preco_unitario: "40.00", subtotal: "60.00" }],
    pagamentos: [],
    acoes: RASCUNHO,
    imprimir_url: "/notas/1-1/imprimir",
    ...extras,
  };
}

const comMilho = () =>
  nota({
    versao: 5,
    total: "160.00",
    saldo: "160.00",
    itens: [
      ...nota().itens,
      { id: 8, descricao: "Milho", quantidade: "2.000", preco_unitario: "50.00", subtotal: "100.00" },
    ],
  });

const GET_NOTA = "GET /api/notas/1-1";
let fetchSimulado: ReturnType<typeof vi.fn>;

/** `GET` da nota devolve `dados()`; as demais requisições vêm de `extra`. */
function simular(dados: () => unknown, extra: (chave: string) => unknown = () => undefined) {
  fetchSimulado = vi.fn(async (url: string, opcoes?: RequestInit) => {
    const chave = `${opcoes?.method ?? "GET"} ${url}`;
    const especial = extra(chave);
    if (especial !== undefined) return especial;
    if (chave === GET_NOTA) return dados();
    throw new Error(`requisição inesperada: ${chave}`);
  });
  vi.stubGlobal("fetch", fetchSimulado);
}

const chamadas = () => fetchSimulado.mock.calls.map(([url, o]) => `${o?.method ?? "GET"} ${url}`);
const corpoDe = (chave: string) => {
  const chamada = fetchSimulado.mock.calls.find(([url, o]) => `${o?.method ?? "GET"} ${url}` === chave);
  return JSON.parse(chamada![1].body);
};

function adiado() {
  let liberar: () => void = () => {};
  const promessa = new Promise<void>((resolve) => (liberar = resolve));
  return { promessa, liberar: () => liberar() };
}

function abrir(rota = "/?nota=01-01") {
  renderizarComApp(<GavetaDaNota />, { rota });
  return userEvent.setup();
}

const gaveta = () => screen.findByRole("dialog", { name: "Nota 01-01" });
const linhaDoResumo = (rotulo: string) => screen.getByText(rotulo).closest("div") as HTMLElement;
const local = () => screen.getByTestId("local");

/** Espera o valor de uma linha do resumo. `<Dinheiro animar>` conta por requestAnimationFrame, que no jsdom anda devagar com a suíte toda em paralelo: a espera tem folga. */
const resumoChegaA = (rotulo: string, valor: string) =>
  waitFor(() => expect(linhaDoResumo(rotulo)).toHaveTextContent(valor), { timeout: 4000 });

async function digitarItem(usuario: ReturnType<typeof userEvent.setup>, descricao: string, quantidade: string, preco: string) {
  await usuario.type(await screen.findByLabelText("Descrição"), descricao);
  await usuario.clear(screen.getByLabelText("Quantidade"));
  await usuario.type(screen.getByLabelText("Quantidade"), quantidade);
  await usuario.type(screen.getByLabelText("Preço"), `${preco}{Enter}`);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GavetaDaNota", () => {
  it("sem ?nota não abre nem busca nada", () => {
    simular(() => responder(nota()));
    abrir("/clientes");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it("com ?nota=01-01 busca /api/notas/1-1 e mostra código, cliente, itens e saldo", async () => {
    simular(() => responder(nota()));
    abrir();
    const painel = await gaveta();
    expect(chamadas()).toEqual([GET_NOTA]);
    expect(await within(painel).findByRole("link", { name: "01 · Maria" })).toHaveAttribute("href", "/clientes/1");
    expect(within(painel).getByRole("heading", { name: "Nota 01-01" })).toBeInTheDocument();
    expect(within(painel).getByText("Única")).toBeInTheDocument();
    expect(within(painel).getByText("Rascunho")).toBeInTheDocument();
    expect(within(painel).getByText("3 dias")).toBeInTheDocument();
    const item = within(painel).getByText("Ração 15kg").closest("li") as HTMLElement;
    expect(item).toHaveTextContent("1,5");
    expect(item).toHaveTextContent("R$ 40,00");
    expect(item).toHaveTextContent("R$ 60,00");
    expect(linhaDoResumo("Total")).toHaveTextContent("R$ 60,00");
    expect(linhaDoResumo("Pago")).toHaveTextContent("R$ 0,00");
    expect(linhaDoResumo("Saldo")).toHaveTextContent("R$ 60,00");
    expect(within(painel).queryByText("Editado")).not.toBeInTheDocument();
    expect(within(painel).queryByText("Quitada")).not.toBeInTheDocument();
  });

  it("nota de 1 dia usa o singular", async () => {
    simular(() => responder(nota({ dias_em_aberto: 1 })));
    abrir();
    expect(await screen.findByText("1 dia")).toBeInTheDocument();
  });

  it("nota quitada e editada mostra os selos, a data da quitação e os pagamentos com recibo", async () => {
    simular(() =>
      responder(
        nota({
          situacao: "QUITADA",
          situacao_rotulo: "Quitada",
          quitada_em: "2026-10-01T12:00:00-03:00",
          editada: true,
          total_pago: "60.00",
          saldo: "0.00",
          acoes: QUITADA,
          pagamentos: [
            {
              id: 3,
              valor: "60.00",
              forma: "PIX",
              forma_rotulo: "Pix",
              recebido_em: "2026-10-01T12:00:00-03:00",
              recebido_por: "Bel",
              recibo_url: "/recibos/3",
            },
          ],
        }),
      ),
    );
    abrir();
    const painel = await gaveta();
    expect(await within(painel).findByText("quitada em 01/10/2026")).toBeInTheDocument();
    expect(within(painel).getByText("Editado")).toBeInTheDocument();
    expect(within(painel).getByText("Quitada")).toBeInTheDocument();
    expect(within(painel).queryByText(/\d+ dias?$/)).not.toBeInTheDocument();
    const recibo = within(painel).getByRole("link", { name: "Recibo" });
    expect(recibo).toHaveAttribute("href", "/recibos/3");
    expect(recibo).toHaveAttribute("target", "_blank");
    const pagamento = recibo.closest("li") as HTMLElement;
    expect(pagamento).toHaveTextContent("01/10/2026");
    expect(pagamento).toHaveTextContent("Pix");
    expect(pagamento).toHaveTextContent("Bel");
    expect(pagamento).toHaveTextContent("R$ 60,00");
    expect(within(painel).queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
    expect(within(painel).queryByLabelText("Descrição")).not.toBeInTheDocument();
  });

  const TODOS = ["Finalizar e imprimir", "Fechar nota", "Reimprimir", "Descartar", "Receber", "Correção"];
  it.each([
    ["rascunho", RASCUNHO, ["Finalizar e imprimir", "Descartar"]],
    ["contínua aberta", CONTINUA_ABERTA, ["Fechar nota", "Reimprimir", "Receber", "Correção"]],
    ["fechada", FECHADA, ["Reimprimir", "Receber", "Correção"]],
    ["quitada", QUITADA, ["Reimprimir"]],
  ])("rodapé da nota %s segue acoes", async (_nome, acoes, esperados) => {
    // A situação fica fixa de propósito: os botões só podem sair de `acoes`.
    simular(() => responder(nota({ acoes })));
    abrir();
    await screen.findByText("Ração 15kg");
    for (const rotulo of TODOS) {
      const botao = screen.queryByRole("button", { name: rotulo });
      if (esperados.includes(rotulo)) expect(botao, rotulo).toBeInTheDocument();
      else expect(botao, rotulo).not.toBeInTheDocument();
    }
    expect(screen.queryAllByRole("button", { name: "Remover" })).toHaveLength(acoes.remover_item ? 1 : 0);
    expect(screen.queryAllByLabelText("Descrição")).toHaveLength(acoes.adicionar_item ? 1 : 0);
  });

  it("Reimprimir abre a impressão; Receber e Correção ainda não mostram nada", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    simular(() => responder(nota({ acoes: CONTINUA_ABERTA })));
    const usuario = abrir();
    await usuario.click(await screen.findByRole("button", { name: "Reimprimir" }));
    expect(abrirJanela).toHaveBeenCalledWith("/notas/1-1/imprimir", "_blank", "noopener");
    await usuario.click(screen.getByRole("button", { name: "Receber" }));
    await usuario.click(screen.getByRole("button", { name: "Correção" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(chamadas()).toEqual([GET_NOTA]);
  });

  it("adicionar item envia a versão da nota carregada e atualiza total e saldo sem novo GET", async () => {
    simular(
      () => responder(nota()),
      (chave) => (chave === "POST /api/notas/1-1/itens" ? responder(comMilho()) : undefined),
    );
    const usuario = abrir();
    await digitarItem(usuario, "Milho", "2", "50,00");
    await resumoChegaA("Saldo", "R$ 160,00");
    await resumoChegaA("Total", "R$ 160,00");
    expect(screen.getByText("Milho").closest("li")).toHaveTextContent("R$ 100,00");
    expect(corpoDe("POST /api/notas/1-1/itens")).toEqual({
      versao: 4,
      descricao: "Milho",
      quantidade: "2.000",
      preco_unitario: "50.00",
    });
    expect(chamadas().filter((c) => c === GET_NOTA)).toHaveLength(1);
    expect(screen.getByLabelText("Descrição")).toHaveFocus();
    expect(screen.getByLabelText("Descrição")).toHaveValue("");
    expect(screen.getByLabelText("Quantidade")).toHaveValue("1");
  });

  it("409 ao adicionar item mostra a mensagem, recarrega a nota e mantém a gaveta aberta", async () => {
    let atual = nota();
    simular(
      () => responder(atual),
      (chave) =>
        chave === "POST /api/notas/1-1/itens"
          ? responder({ erro: "A nota mudou em outra tela. Confira e tente de novo." }, 409)
          : undefined,
    );
    const usuario = abrir();
    await screen.findByText("Ração 15kg");
    atual = comMilho();
    await digitarItem(usuario, "Sal", "1", "5,00");
    expect(await screen.findByRole("alert")).toHaveTextContent("A nota mudou em outra tela. Confira e tente de novo.");
    expect(await screen.findByText("Milho")).toBeInTheDocument();
    expect(chamadas().filter((c) => c === GET_NOTA)).toHaveLength(2);
    expect(await gaveta()).toBeInTheDocument();
    expect(local()).toHaveTextContent("/?nota=01-01");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Sal");
  });

  it("Remover só chama a API depois da confirmação, e dois cliques mandam um único DELETE", async () => {
    const espera = adiado();
    simular(
      () => responder(nota()),
      (chave) =>
        chave === "DELETE /api/notas/1-1/itens/7"
          ? espera.promessa.then(() => responder(nota({ versao: 5, itens: [], total: "0.00", saldo: "0.00" })))
          : undefined,
    );
    const usuario = abrir();
    await usuario.click(await screen.findByRole("button", { name: "Remover" }));
    const confirmacao = screen.getByRole("dialog", { name: "Remover item" });
    expect(confirmacao).toHaveTextContent("Remover este item?");
    expect(chamadas()).toEqual([GET_NOTA]);
    const confirmar = within(confirmacao).getByRole("button", { name: "Remover" });
    await usuario.click(confirmar);
    await usuario.click(confirmar);
    expect(confirmar).toBeDisabled();
    espera.liberar();
    await waitFor(() => expect(screen.queryByText("Ração 15kg")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog", { name: "Remover item" })).not.toBeInTheDocument();
    expect(chamadas().filter((c) => c.startsWith("DELETE"))).toEqual(["DELETE /api/notas/1-1/itens/7"]);
    expect(corpoDe("DELETE /api/notas/1-1/itens/7")).toEqual({ versao: 4 });
    await resumoChegaA("Total", "R$ 0,00");
  });

  it("cancelar a confirmação de Remover não chama a API", async () => {
    simular(() => responder(nota()));
    const usuario = abrir();
    await usuario.click(await screen.findByRole("button", { name: "Remover" }));
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Remover item" })).not.toBeInTheDocument();
    expect(chamadas()).toEqual([GET_NOTA]);
    expect(screen.getByText("Ração 15kg")).toBeInTheDocument();
  });

  it("Descartar só chama a API depois da confirmação, e dois cliques mandam um único DELETE", async () => {
    const espera = adiado();
    simular(
      () => responder(nota()),
      (chave) => (chave === "DELETE /api/notas/1-1" ? espera.promessa.then(() => responder({})) : undefined),
    );
    const usuario = abrir("/clientes/1?nota=01-01");
    await usuario.click(await screen.findByRole("button", { name: "Descartar" }));
    const confirmacao = screen.getByRole("dialog", { name: "Descartar nota" });
    expect(confirmacao).toHaveTextContent("Descartar esta nota? Não dá para desfazer.");
    expect(chamadas()).toEqual([GET_NOTA]);
    const confirmar = within(confirmacao).getByRole("button", { name: "Descartar" });
    await usuario.click(confirmar);
    await usuario.click(confirmar);
    espera.liberar();
    await waitFor(() => expect(local()).toHaveTextContent(/^\/clientes\/1$/));
    expect(chamadas().filter((c) => c.startsWith("DELETE"))).toEqual(["DELETE /api/notas/1-1"]);
    expect(corpoDe("DELETE /api/notas/1-1")).toEqual({ versao: 4 });
  });

  it("descarte com sucesso fecha a gaveta e não busca mais a nota", async () => {
    simular(
      () => responder(nota()),
      (chave) => (chave === "DELETE /api/notas/1-1" ? responder({}) : undefined),
    );
    const usuario = abrir("/clientes/1?nota=01-01");
    await usuario.click(await screen.findByRole("button", { name: "Descartar" }));
    await usuario.click(within(screen.getByRole("dialog", { name: "Descartar nota" })).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(local()).toHaveTextContent(/^\/clientes\/1$/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const feitas = chamadas();
    expect(feitas.slice(feitas.indexOf("DELETE /api/notas/1-1") + 1).filter((c) => c === GET_NOTA)).toHaveLength(0);
    expect(screen.queryByText("Nota não encontrada.")).not.toBeInTheDocument();
  });

  it("reabrir o mesmo código depois do descarte busca a nota nova, sem erro nem dado da antiga", async () => {
    let atual = nota();
    simular(
      () => responder(atual),
      (chave) => {
        if (chave === "DELETE /api/notas/1-1") return responder({});
        if (chave === "POST /api/notas/1-1/fechar") return responder({ erro: "Nota sem itens." }, 400);
        return undefined;
      },
    );
    renderizarComApp(
      <>
        <Link to="/?nota=01-01">Reabrir</Link>
        <GavetaDaNota />
      </>,
      { rota: "/?nota=01-01" },
    );
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("button", { name: "Descartar" }));
    await usuario.click(within(screen.getByRole("dialog", { name: "Descartar nota" })).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    atual = nota({ versao: 1, itens: [], total: "0.00", saldo: "0.00", acoes: { ...CONTINUA_ABERTA } });
    await usuario.click(screen.getByRole("link", { name: "Reabrir" }));
    expect(await screen.findByRole("button", { name: "Fechar nota" })).toBeInTheDocument();
    expect(screen.queryByText("Ração 15kg")).not.toBeInTheDocument();
    expect(chamadas().filter((c) => c === GET_NOTA)).toHaveLength(2);

    // Um erro mostrado numa abertura não volta na seguinte.
    await usuario.click(screen.getByRole("button", { name: "Fechar nota" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await usuario.click(screen.getByRole("link", { name: "Reabrir" }));
    expect(await screen.findByRole("button", { name: "Fechar nota" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("erro ao descartar fecha a confirmação, mostra a mensagem e mantém a gaveta", async () => {
    simular(
      () => responder(nota()),
      (chave) => (chave === "DELETE /api/notas/1-1" ? responder({ erro: "Esta nota já tem pagamento." }, 400) : undefined),
    );
    const usuario = abrir();
    await usuario.click(await screen.findByRole("button", { name: "Descartar" }));
    await usuario.click(within(screen.getByRole("dialog", { name: "Descartar nota" })).getByRole("button", { name: "Descartar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta nota já tem pagamento.");
    expect(screen.queryByRole("dialog", { name: "Descartar nota" })).not.toBeInTheDocument();
    expect(await gaveta()).toBeInTheDocument();
    expect(screen.getByText("Ração 15kg")).toBeInTheDocument();
  });

  it("Finalizar e imprimir abre a impressão só depois da resposta, com o botão travado enquanto isso", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const espera = adiado();
    const finalizada = nota({ versao: 5, situacao: "ABERTA", situacao_rotulo: "Aberta", acoes: FECHADA });
    simular(
      () => responder(nota()),
      (chave) => (chave === "POST /api/notas/1-1/finalizar" ? espera.promessa.then(() => responder(finalizada)) : undefined),
    );
    const usuario = abrir();
    const finalizar = await screen.findByRole("button", { name: "Finalizar e imprimir" });
    await usuario.click(finalizar);
    expect(finalizar).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
    expect(abrirJanela).not.toHaveBeenCalled();
    espera.liberar();
    await waitFor(() => expect(abrirJanela).toHaveBeenCalledWith("/notas/1-1/imprimir", "_blank", "noopener"));
    expect(corpoDe("POST /api/notas/1-1/finalizar")).toEqual({ versao: 4 });
    expect(await screen.findByRole("button", { name: "Receber" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finalizar e imprimir" })).not.toBeInTheDocument();
    expect(chamadas().filter((c) => c === GET_NOTA)).toHaveLength(1);
  });

  it("Fechar nota chama a API e mostra o erro que vier", async () => {
    simular(
      () => responder(nota({ acoes: CONTINUA_ABERTA })),
      (chave) => (chave === "POST /api/notas/1-1/fechar" ? responder({ erro: "Nota sem itens." }, 400) : undefined),
    );
    const usuario = abrir();
    await usuario.click(await screen.findByRole("button", { name: "Fechar nota" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nota sem itens.");
    expect(corpoDe("POST /api/notas/1-1/fechar")).toEqual({ versao: 4 });
  });

  it("nota inexistente mostra a mensagem e um botão Fechar que tira ?nota do endereço", async () => {
    simular(() => responder({ erro: "Não encontrado." }, 404));
    const usuario = abrir("/clientes?nota=01-01");
    expect(await screen.findByText("Nota não encontrada.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();
    const fechar = screen.getAllByRole("button", { name: "Fechar" });
    await usuario.click(fechar[fechar.length - 1]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(local()).toHaveTextContent(/^\/clientes$/);
  });

  it("Esc fecha a gaveta, tira nota do endereço e mantém o resto da busca", async () => {
    simular(() => responder(nota()));
    const usuario = abrir("/clientes?q=ana&nota=01-01&pagina=2");
    await screen.findByText("Ração 15kg");
    await usuario.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(local()).toHaveTextContent(/^\/clientes\?q=ana&pagina=2$/);
  });

  it("Finalizar e imprimir abre a impressão sem esperar as listas recarregarem", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const finalizada = nota({ versao: 5, situacao: "ABERTA", situacao_rotulo: "Aberta", acoes: FECHADA });
    let buscasDoPainel = 0;
    simular(
      () => responder(nota()),
      (chave) => {
        if (chave === "POST /api/notas/1-1/finalizar") return responder(finalizada);
        // A primeira carga do painel responde; a recarga pedida pela mutação nunca termina.
        if (chave === "GET /api/painel") return buscasDoPainel++ === 0 ? responder({}) : new Promise(() => {});
        return undefined;
      },
    );
    function Painel() {
      const painel = useQuery({ queryKey: ["painel"], queryFn: () => fetch("/api/painel", { method: "GET" }) });
      return painel.isSuccess ? <p>painel carregado</p> : null;
    }
    renderizarComApp(
      <>
        <Painel />
        <GavetaDaNota />
      </>,
      { rota: "/?nota=01-01" },
    );
    const usuario = userEvent.setup();
    await screen.findByText("painel carregado");
    await usuario.click(await screen.findByRole("button", { name: "Finalizar e imprimir" }));
    await waitFor(() => expect(abrirJanela).toHaveBeenCalledWith("/notas/1-1/imprimir", "_blank", "noopener"));
    expect(buscasDoPainel).toBe(2);
    // As ações da nota também destravam sem esperar as listas.
    expect(await screen.findByRole("button", { name: "Receber" })).toBeEnabled();
  });

  it("com movimento reduzido, o item novo entra sem fade", async () => {
    simular(
      () => responder(nota()),
      (chave) => (chave === "POST /api/notas/1-1/itens" ? responder(comMilho()) : undefined),
    );
    const desfazer = simularMovimentoReduzido();
    try {
      const usuario = abrir();
      await digitarItem(usuario, "Milho", "2", "50,00");
      const linha = (await screen.findByText("Milho")).closest("li") as HTMLElement;
      await waitFor(() => {
        expect(linha).toHaveStyle({ opacity: "1" });
        expect(linha.style.transform).not.toMatch(/translate/);
      });
      expect(linhaDoResumo("Total")).toHaveTextContent("R$ 160,00");
    } finally {
      desfazer();
    }
  });

  it("com movimento reduzido, o aviso de erro aparece sem fade", async () => {
    simular(
      () => responder(nota({ acoes: CONTINUA_ABERTA })),
      (chave) => (chave === "POST /api/notas/1-1/fechar" ? responder({ erro: "Nota sem itens." }, 400) : undefined),
    );
    const desfazer = simularMovimentoReduzido();
    try {
      const usuario = abrir();
      await usuario.click(await screen.findByRole("button", { name: "Fechar nota" }));
      const falha = (await screen.findByRole("alert")).closest(".nota__falha") as HTMLElement;
      await waitFor(() => {
        expect(falha).toHaveStyle({ opacity: "1" });
        expect(falha.style.transform).not.toMatch(/translate/);
      });
    } finally {
      desfazer();
    }
  });
});
