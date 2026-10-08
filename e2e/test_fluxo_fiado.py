"""Ponta a ponta contra o Django servindo o front gerado.

Antes de rodar: npm --prefix frontend run build
"""

import os
import re

import pytest
from playwright.sync_api import expect

os.environ.setdefault("DJANGO_ALLOW_ASYNC_UNSAFE", "true")

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def caixa(django_user_model):
    return django_user_model.objects.create_user("caixa1", password="senha-forte-1")


@pytest.fixture
def pagina(page, context, live_server, caixa):
    # Vale para a página e para as abas de impressão que ela abre.
    context.add_init_script("window.print = () => {}")
    page.goto(live_server.url + "/")
    page.get_by_label("Usuário").fill("caixa1")
    page.get_by_label("Senha").fill("senha-forte-1")
    page.get_by_role("button", name="Entrar").click()
    expect(page.get_by_role("heading", name="Painel")).to_be_visible()
    return page


def _aba_de_impressao(context, acionar):
    """Dispara a ação que abre a página de impressão e devolve a nova aba."""
    with context.expect_page() as nova:
        acionar()
    aba = nova.value
    aba.wait_for_load_state()
    return aba


def test_do_cadastro_ate_contas_pagas(pagina, context):
    page = pagina
    gaveta = page.get_by_role("dialog", name="Nota 01-01")
    saldo = gaveta.locator(".resumo__linha--saldo")

    page.get_by_role("link", name="Clientes").click()
    page.get_by_role("button", name="Novo cliente").click()
    page.get_by_role("dialog", name="Novo cliente").get_by_label("Nome", exact=True).fill(
        "Maria da Silva"
    )
    page.get_by_role("button", name="Criar cliente").click()
    expect(page.get_by_role("heading", level=1)).to_contain_text("01 · Maria da Silva")

    page.get_by_role("button", name="Nova nota única").click()
    expect(gaveta).to_be_visible()

    gaveta.get_by_label("Descrição").fill("Ração 15kg")
    gaveta.get_by_label("Quantidade").fill("1")
    gaveta.get_by_label("Preço").fill("100,00")
    gaveta.get_by_label("Preço").press("Enter")
    expect(gaveta.locator(".itens__lista")).to_contain_text("Ração 15kg")
    expect(saldo).to_contain_text("R$ 100,00")

    nota = _aba_de_impressao(
        context, lambda: gaveta.get_by_role("button", name="Finalizar e imprimir").click()
    )
    expect(nota.locator("body")).to_contain_text("VIA DO CLIENTE")
    expect(nota.locator(".codigo").first).to_have_text("01-01")
    nota.close()

    gaveta.get_by_role("button", name="Receber", exact=True).click()
    gaveta.get_by_label("Valor").fill("40,00")
    recibo = _aba_de_impressao(
        context, lambda: gaveta.get_by_role("button", name="Confirmar pagamento").click()
    )
    expect(recibo.locator("body")).to_contain_text("RECIBO DE PAGAMENTO")
    recibo.close()
    expect(saldo).to_contain_text("R$ 60,00")

    gaveta.get_by_role("button", name="Receber", exact=True).click()
    expect(gaveta.get_by_label("Valor")).to_have_value("60,00")
    recibo = _aba_de_impressao(
        context, lambda: gaveta.get_by_role("button", name="Confirmar pagamento").click()
    )
    recibo.close()
    expect(gaveta).to_contain_text("Quitada")
    expect(gaveta.get_by_role("button", name="Receber", exact=True)).to_have_count(0)

    page.keyboard.press("Escape")
    expect(gaveta).to_have_count(0)
    page.get_by_role("link", name="Contas pagas").click()
    expect(page.get_by_role("heading", name="Contas pagas")).to_be_visible()
    expect(page.locator(".pagas")).to_contain_text("01-01")


def test_busca_pelo_codigo_abre_a_gaveta_e_voltar_fecha(pagina, caixa):
    from fiado.servicos.clientes import criar_cliente
    from fiado.tests.fabrica import nota_unica_fechada

    nota_unica_fechada(criar_cliente(nome="Maria da Silva", apelido="", telefone=""), caixa)
    page = pagina
    gaveta = page.get_by_role("dialog", name="Nota 01-01")

    busca = page.get_by_role("combobox", name="Busca rápida")
    busca.fill("01-01")
    expect(page.get_by_role("option")).to_contain_text("01-01")
    busca.press("Enter")

    expect(gaveta).to_be_visible()
    expect(page).to_have_url(re.compile(r"nota=01-01"))

    page.go_back()
    expect(gaveta).to_have_count(0)
    expect(page).not_to_have_url(re.compile(r"nota="))


def test_da_busca_ao_item_na_continua_so_com_teclado(pagina, caixa):
    from fiado.servicos.clientes import criar_cliente
    from fiado.tests.fabrica import nota_continua_aberta

    nota_continua_aberta(criar_cliente(nome="Maria da Silva", apelido="", telefone=""), caixa)
    page = pagina
    gaveta = page.get_by_role("dialog", name="Nota 01-01")
    descricao = gaveta.get_by_label("Descrição")

    page.keyboard.press("F2")
    expect(page.get_by_role("combobox", name="Busca rápida")).to_be_focused()
    page.keyboard.type("maria")
    expect(page.get_by_role("option")).to_have_count(2)
    page.keyboard.press("ArrowDown")
    page.keyboard.press("Enter")

    expect(descricao).to_be_focused()
    page.keyboard.type("Milho")
    page.keyboard.press("Tab")
    page.keyboard.press("Tab")
    page.keyboard.type("50,00")
    page.keyboard.press("Enter")

    expect(gaveta.locator(".itens__lista")).to_contain_text("Milho")
    expect(gaveta.locator(".resumo__linha--saldo")).to_contain_text("R$ 150,00")
    expect(descricao).to_be_focused()
