import os

import pytest
from playwright.sync_api import expect

os.environ.setdefault("DJANGO_ALLOW_ASYNC_UNSAFE", "true")


@pytest.mark.django_db(transaction=True)
def test_do_cadastro_ate_contas_pagas(page, live_server, django_user_model):
    django_user_model.objects.create_user("caixa1", password="senha-forte-1")
    page.add_init_script("window.print = () => {}")

    page.goto(live_server.url + "/")
    page.fill("input[name=username]", "caixa1")
    page.fill("input[name=password]", "senha-forte-1")
    page.get_by_role("button", name="Entrar").click()
    expect(page.get_by_role("heading", name="Painel")).to_be_visible()

    page.get_by_role("link", name="Clientes").click()
    page.get_by_role("link", name="Novo cliente").click()
    page.fill("input[name=nome]", "Maria da Silva")
    page.get_by_role("button", name="Salvar").click()
    expect(page.get_by_role("heading", level=1)).to_contain_text("01 · Maria da Silva")

    page.get_by_role("button", name="Nova nota única").click()
    expect(page.get_by_role("heading", level=1)).to_contain_text("Nota 01-01")
    page.fill("input[name=descricao]", "Ração 15kg")
    page.fill("input[name=preco_unitario]", "100,00")
    page.get_by_role("button", name="Adicionar item").click()
    expect(page.locator("table.itens")).to_contain_text("Ração 15kg")
    expect(page.locator(".totais")).to_contain_text("Saldo: R$ 100,00")

    page.get_by_role("button", name="Finalizar e imprimir").click()
    expect(page.locator("body")).to_contain_text("VIA DO CLIENTE")
    expect(page.locator(".codigo").first).to_have_text("01-01")
    page.get_by_role("link", name="Voltar").click()

    page.get_by_role("button", name="Pagamento", exact=True).click()
    page.fill("input[name=valor]", "40,00")
    page.get_by_role("button", name="Confirmar pagamento").click()
    expect(page.locator("body")).to_contain_text("RECIBO DE PAGAMENTO")
    expect(page.locator("body")).to_contain_text("60,00")
    page.get_by_role("link", name="Voltar").click()
    expect(page.locator(".totais")).to_contain_text("Saldo: R$ 60,00")

    page.get_by_role("button", name="Pagamento", exact=True).click()
    expect(page.locator("input[name=valor]")).to_have_value("60,00")
    page.get_by_role("button", name="Confirmar pagamento").click()
    page.get_by_role("link", name="Voltar").click()
    expect(page.locator("#nota-corpo")).to_contain_text("Quitada")
    expect(page.get_by_role("button", name="Pagamento", exact=True)).to_have_count(0)

    page.get_by_role("link", name="Contas pagas").click()
    expect(page.locator("table")).to_contain_text("01-01")

    page.fill("input[name=q]", "01-01")
    page.keyboard.press("Enter")
    expect(page.get_by_role("heading", level=1)).to_contain_text("Nota 01-01")
