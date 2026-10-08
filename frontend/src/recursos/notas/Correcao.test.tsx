import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACOES_FECHADA, adiado, notaDeTeste, simularFetch } from "../../teste/notas";
import { renderizarComApp, responder } from "../../teste/renderizar";
import { GavetaDaNota } from "./GavetaDaNota";

const GET_NOTA = "GET /api/notas/1-1";
const PUT = "PUT /api/notas/1-1/itens";

const corrigida = () =>
  notaDeTeste({
    versao: 5,
    editada: true,
    total: "68.75",
    saldo: "68.75",
    itens: [
      { id: 11, descricao: "Ração 15kg", quantidade: "1.500", preco_unitario: "42.50", subtotal: "63.75" },
      { id: 12, descricao: "Sal", quantidade: "1.000", preco_unitario: "5.00", subtotal: "5.00" },
    ],
    imprimir_url: "/notas/1-1/imprimir/?v=5",
  });

/** A nota depois de outra tela acrescentar um item: versão 5, total 172,00. */
const comItemDeOutraTela = () => {
  const base = notaDeTeste();
  return notaDeTeste({
    versao: 5,
    total: "172.00",
    saldo: "172.00",
    itens: [...base.itens, { id: 9, descricao: "Sal mineral", quantidade: "1.000", preco_unitario: "12.00", subtotal: "12.00" }],
  });
};

const total = () => screen.getByText("Total").closest("div") as HTMLElement;

/** A janela volta a ter foco: a nota aberta é buscada de novo, por baixo do formulário. */
async function voltarAJanela(api: { quantas: (chave: string) => number }) {
  act(() => {
    window.dispatchEvent(new Event("visibilitychange"));
  });
  await waitFor(() => expect(api.quantas(GET_NOTA)).toBe(2));
  await waitFor(() => expect(total()).toHaveTextContent("R$ 172,00"), { timeout: 4000 });
}

/** Abre a gaveta da nota 01-01 e clica em Correção. */
async function abrirCorrecao(rotas: (chave: string) => unknown, dados = () => notaDeTeste()) {
  const api = simularFetch((chave) => rotas(chave) ?? (chave === GET_NOTA ? responder(dados()) : undefined));
  renderizarComApp(<GavetaDaNota />, { rota: "/?nota=01-01" });
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole("button", { name: "Correção" }));
  return { api, usuario };
}

const formulario = () => screen.queryByRole("form", { name: "Correção dos itens" });
const descricao = (n: number) => screen.getByLabelText(`Descrição do item ${n}`);

/** Abre a gaveta da nota 01-01 sem entrar em modo nenhum. */
async function abrirNota(dados = () => notaDeTeste()) {
  const api = simularFetch((chave) => (chave === GET_NOTA ? responder(dados()) : undefined));
  renderizarComApp(<GavetaDaNota />, { rota: "/?nota=01-01" });
  const usuario = userEvent.setup();
  await screen.findByText("Ração 15kg");
  return { api, usuario };
}

const continuaAberta = () =>
  notaDeTeste({ tipo: "CONTINUA", tipo_rotulo: "Contínua", situacao: "ABERTA", situacao_rotulo: "Aberta", acoes: { ...ACOES_FECHADA, adicionar_item: true, fechar: true } });
const rascunho = () =>
  notaDeTeste({
    situacao: "RASCUNHO",
    situacao_rotulo: "Rascunho",
    acoes: { ...ACOES_FECHADA, receber: false, corrigir: false, imprimir: false, adicionar_item: true, remover_item: true },
  });
const linhaDoItem = (descricaoDoItem: RegExp) => screen.queryByRole("button", { name: descricaoDoItem });
const gavetaAberta = () => screen.queryByRole("dialog", { name: "Nota 01-01" });
const quantidade = (n: number) => screen.getByLabelText(`Quantidade do item ${n}`);
const preco = (n: number) => screen.getByLabelText(`Preço do item ${n}`);
const salvar = () => screen.getByRole("button", { name: "Salvar correção e reimprimir" });

async function trocar(usuario: ReturnType<typeof userEvent.setup>, campo: HTMLElement, texto: string) {
  await usuario.clear(campo);
  if (texto) await usuario.type(campo, texto);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Correcao", () => {
  it("os itens viram uma linha de campos cada, preenchidos, no lugar da lista e das ações", async () => {
    await abrirCorrecao(() => undefined);
    expect(formulario()).toBeInTheDocument();
    expect(descricao(1)).toHaveValue("Ração 15kg");
    expect(descricao(1)).toHaveFocus();
    expect(quantidade(1)).toHaveValue("1,5");
    expect(preco(1)).toHaveValue("40,00");
    expect(descricao(2)).toHaveValue("Milho");
    expect(quantidade(2)).toHaveValue("2");
    expect(preco(2)).toHaveValue("50,00");
    expect(screen.queryByLabelText("Descrição do item 3")).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Correção" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receber" })).not.toBeInTheDocument();
  });

  it("envia a lista editada, com a linha nova e a linha em branco; em sucesso volta à leitura e reimprime", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const { api, usuario } = await abrirCorrecao((chave) => (chave === PUT ? responder(corrigida()) : undefined));
    await trocar(usuario, preco(1), "42,50");
    await trocar(usuario, descricao(2), "");
    await trocar(usuario, quantidade(2), "");
    await trocar(usuario, preco(2), "");
    await usuario.click(screen.getByRole("button", { name: "Adicionar linha" }));
    expect(descricao(3)).toHaveFocus();
    await usuario.type(descricao(3), "Sal");
    await usuario.type(quantidade(3), "1");
    await usuario.type(preco(3), "5,00");
    await usuario.click(salvar());
    await waitFor(() => expect(abrirJanela).toHaveBeenCalledWith("/notas/1-1/imprimir/?v=5", "_blank", "noopener"));
    expect(abrirJanela).toHaveBeenCalledTimes(1);
    expect(api.corpoDe(PUT)).toEqual({
      versao: 4,
      itens: [
        { descricao: "Ração 15kg", quantidade: "1.500", preco_unitario: "42.50" },
        { descricao: "", quantidade: "", preco_unitario: "" },
        { descricao: "Sal", quantidade: "1.000", preco_unitario: "5.00" },
      ],
    });
    await waitFor(() => expect(formulario()).not.toBeInTheDocument());
    expect(screen.getByText("Sal").closest("li")).toHaveTextContent("R$ 5,00");
    expect(screen.queryByText("Milho")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Correção" })).toBeEnabled();
    expect(api.quantas(GET_NOTA)).toBe(1);
  });

  it("campo numérico inválido marca o campo e não envia", async () => {
    const { api, usuario } = await abrirCorrecao(() => undefined);
    await trocar(usuario, quantidade(1), "um");
    await trocar(usuario, preco(2), "5,123");
    await usuario.click(salvar());
    expect(quantidade(1)).toBeInvalid();
    expect(quantidade(1)).toHaveAccessibleDescription("Número inválido.");
    expect(preco(2)).toBeInvalid();
    expect(preco(1)).not.toBeInvalid();
    expect(quantidade(2)).not.toBeInvalid();
    expect(api.quantas(PUT)).toBe(0);
    await trocar(usuario, quantidade(1), "1");
    expect(quantidade(1)).not.toBeInvalid();
    expect(preco(2)).toBeInvalid();
  });

  it("erro 400 em itens.0.preco_unitario marca o preço da primeira linha e mantém o que foi digitado", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    const { usuario } = await abrirCorrecao((chave) =>
      chave === PUT
        ? responder(
            { erro: "Confira os campos destacados.", campos: { "itens.0.preco_unitario": "Informe um número válido." } },
            400,
          )
        : undefined,
    );
    await trocar(usuario, descricao(2), "Milho moído");
    await usuario.click(salvar());
    await waitFor(() => expect(preco(1)).toBeInvalid());
    expect(preco(1)).toHaveAccessibleDescription("Informe um número válido.");
    expect(preco(2)).not.toBeInvalid();
    expect(quantidade(1)).not.toBeInvalid();
    expect(descricao(1)).not.toBeInvalid();
    expect(screen.getByRole("alert")).toHaveTextContent("Confira os campos destacados.");
    expect(descricao(2)).toHaveValue("Milho moído");
    expect(salvar()).toBeEnabled();
    expect(abrirJanela).not.toHaveBeenCalled();
  });

  it("erro 400 em itens.1.descricao marca a descrição da segunda linha", async () => {
    const { usuario } = await abrirCorrecao((chave) =>
      chave === PUT
        ? responder({ erro: "Confira os campos destacados.", campos: { "itens.1.descricao": "Preencha este campo." } }, 400)
        : undefined,
    );
    await trocar(usuario, descricao(2), "");
    await usuario.click(salvar());
    await waitFor(() => expect(descricao(2)).toBeInvalid());
    expect(descricao(2)).toHaveAccessibleDescription("Preencha este campo.");
    expect(descricao(1)).not.toBeInvalid();
  });

  it("409 mostra o aviso, recarrega a nota e volta à leitura descartando o digitado", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    let atual = notaDeTeste();
    const { api, usuario } = await abrirCorrecao(
      (chave) =>
        chave === PUT ? responder({ erro: "A nota mudou em outra tela. Confira e tente de novo." }, 409) : undefined,
      () => atual,
    );
    atual = corrigida();
    await trocar(usuario, descricao(1), "Ração errada");
    await usuario.click(salvar());
    expect(await screen.findByRole("alert")).toHaveTextContent("A nota mudou em outra tela. Confira e tente de novo.");
    expect(formulario()).not.toBeInTheDocument();
    expect(await screen.findByText("Sal")).toBeInTheDocument();
    expect(api.quantas(GET_NOTA)).toBe(2);
    expect(screen.queryByText("Ração errada")).not.toBeInTheDocument();
    expect(abrirJanela).not.toHaveBeenCalled();
    // Reabrir a correção parte da nota recarregada, não do que tinha sido digitado.
    await usuario.click(screen.getByRole("button", { name: "Correção" }));
    expect(descricao(1)).toHaveValue("Ração 15kg");
    expect(preco(1)).toHaveValue("42,50");
    expect(descricao(2)).toHaveValue("Sal");
  });

  it("envia a versão que a nota tinha ao abrir a correção, mesmo com uma mais nova no cache", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    let atual = notaDeTeste();
    const { api, usuario } = await abrirCorrecao(
      (chave) => (chave === PUT ? responder(corrigida()) : undefined),
      () => atual,
    );
    atual = comItemDeOutraTela();
    await voltarAJanela(api);
    // O formulário continua com os dois itens copiados ao abrir.
    expect(screen.queryByLabelText("Descrição do item 3")).not.toBeInTheDocument();
    await usuario.click(salvar());
    await waitFor(() => expect(api.quantas(PUT)).toBe(1));
    expect(api.corpoDe(PUT).versao).toBe(4);
  });

  it("a correção feita sobre uma versão antiga cai no conflito: aviso, leitura e o item da outra tela na nota", async () => {
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(null);
    let atual = notaDeTeste();
    const { api, usuario } = await abrirCorrecao(
      (chave) =>
        chave === PUT ? responder({ erro: "A nota mudou em outra tela. Confira e tente de novo." }, 409) : undefined,
      () => atual,
    );
    atual = comItemDeOutraTela();
    await voltarAJanela(api);
    await usuario.click(salvar());
    expect(await screen.findByRole("alert")).toHaveTextContent("A nota mudou em outra tela. Confira e tente de novo.");
    expect(api.corpoDe(PUT).versao).toBe(4);
    expect(formulario()).not.toBeInTheDocument();
    expect(await screen.findByText("Sal mineral")).toBeInTheDocument();
    expect(api.quantas(GET_NOTA)).toBe(3);
    expect(abrirJanela).not.toHaveBeenCalled();
  });

  it("Cancelar volta à leitura sem enviar", async () => {
    const { api, usuario } = await abrirCorrecao(() => undefined);
    await trocar(usuario, descricao(1), "Outra coisa");
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(formulario()).not.toBeInTheDocument();
    expect(screen.getByText("Ração 15kg")).toBeInTheDocument();
    expect(screen.queryByText("Outra coisa")).not.toBeInTheDocument();
    expect(api.chamadas()).toEqual([GET_NOTA]);
  });

  it("dois cliques rápidos em salvar geram uma requisição só, com tudo travado até a resposta", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const espera = adiado();
    const { api } = await abrirCorrecao((chave) =>
      chave === PUT ? espera.promessa.then(() => responder(corrigida())) : undefined,
    );
    fireEvent.click(salvar());
    fireEvent.click(salvar());
    fireEvent.submit(formulario() as HTMLElement);
    expect(salvar()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adicionar linha" })).toBeDisabled();
    espera.liberar();
    await waitFor(() => expect(formulario()).not.toBeInTheDocument());
    expect(api.quantas(PUT)).toBe(1);
  });

  it("clicar num item abre a correção com o foco e o texto selecionado naquela linha", async () => {
    const { usuario } = await abrirNota();
    await usuario.click(linhaDoItem(/Milho/)!);
    expect(formulario()).toBeInTheDocument();
    const campo = descricao(2) as HTMLInputElement;
    expect(campo).toHaveFocus();
    expect([campo.selectionStart, campo.selectionEnd]).toEqual([0, "Milho".length]);
  });

  it("Enter com o foco num item abre a correção naquela linha", async () => {
    const { usuario } = await abrirNota();
    act(() => linhaDoItem(/Ração 15kg/)!.focus());
    await usuario.keyboard("{Enter}");
    expect(descricao(1)).toHaveFocus();
  });

  it("o botão Correção do rodapé abre na primeira linha, com o texto selecionado", async () => {
    await abrirCorrecao(() => undefined);
    const campo = descricao(1) as HTMLInputElement;
    expect(campo).toHaveFocus();
    expect([campo.selectionStart, campo.selectionEnd]).toEqual([0, "Ração 15kg".length]);
  });

  it("em rascunho os itens não abrem correção", async () => {
    await abrirNota(rascunho);
    expect(linhaDoItem(/Milho/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remover" })).toHaveLength(2);
  });

  it("em Receber os itens não abrem correção", async () => {
    const { usuario } = await abrirNota();
    await usuario.click(screen.getByRole("button", { name: "Receber" }));
    expect(linhaDoItem(/Milho/)).not.toBeInTheDocument();
    expect(screen.getByText("Milho")).toBeInTheDocument();
  });

  it("Esc cancela a correção sem fechar a gaveta; o segundo Esc fecha a gaveta", async () => {
    const { api, usuario } = await abrirCorrecao(() => undefined);
    await trocar(usuario, descricao(1), "Outra coisa");
    await usuario.keyboard("{Escape}");
    expect(formulario()).not.toBeInTheDocument();
    expect(gavetaAberta()).toBeInTheDocument();
    expect(screen.getByText("Ração 15kg")).toBeInTheDocument();
    expect(api.chamadas()).toEqual([GET_NOTA]);
    await usuario.keyboard("{Escape}");
    await waitFor(() => expect(gavetaAberta()).not.toBeInTheDocument());
  });

  it("Esc não cancela enquanto a correção está sendo salva", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const espera = adiado();
    const { usuario } = await abrirCorrecao((chave) => (chave === PUT ? espera.promessa.then(() => responder(corrigida())) : undefined));
    await trocar(usuario, preco(1), "42,50");
    await usuario.click(salvar());
    act(() => descricao(1).focus());
    await usuario.keyboard("{Escape}");
    expect(formulario()).toBeInTheDocument();
    expect(gavetaAberta()).toBeInTheDocument();
    espera.liberar();
    await waitFor(() => expect(formulario()).not.toBeInTheDocument());
  });

  it("ao sair da correção, o foco volta para Descrição do novo item", async () => {
    const { usuario } = await abrirCorrecao(() => undefined, continuaAberta);
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(formulario()).not.toBeInTheDocument();
    expect(screen.getByLabelText("Descrição")).toHaveFocus();
  });
});
