from decimal import Decimal

import pytest

from fiado.models import Nota
from fiado.servicos.notas import criar_nota
from fiado.tests.fabrica import nota_continua_aberta, nota_unica_fechada

pytestmark = pytest.mark.django_db
S, T = Nota.Situacao, Nota.Tipo
ITEM = {"descricao": "Ração 15kg", "quantidade": "2", "preco_unitario": "50,00"}


def _post(logado, nota, acao, dados=None):
    nota.refresh_from_db()
    return logado.post(f"/notas/1-{nota.numero}/{acao}", {"versao": nota.versao, **(dados or {})})


def test_adicionar_item_com_virgula_decimal(logado, cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    resposta = _post(logado, nota, "itens/", ITEM)
    assert resposta["Location"] == "/notas/1-1/"
    assert nota.total == Decimal("100.00")


def test_item_invalido_mostra_erro_e_nao_grava(logado, cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    resposta = logado.post(
        "/notas/1-1/itens/",
        {"versao": nota.versao, "descricao": "Ração", "quantidade": "abc", "preco_unitario": "10"},
        follow=True,
    )
    assert "Confira descrição, quantidade e preço" in resposta.content.decode()
    assert nota.itens.count() == 0


def test_remover_item_do_rascunho(logado, cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    _post(logado, nota, "itens/", ITEM)
    _post(logado, nota, f"itens/{nota.itens.get().id}/remover/")
    assert nota.itens.count() == 0


def test_finalizar_leva_para_a_impressao(logado, cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    _post(logado, nota, "itens/", ITEM)
    resposta = _post(logado, nota, "finalizar/")
    assert resposta["Location"] == "/notas/1-1/imprimir/"
    nota.refresh_from_db()
    assert nota.situacao == S.FECHADA


def test_finalizar_sem_item_mostra_erro(logado, cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    resposta = logado.post("/notas/1-1/finalizar/", {"versao": nota.versao}, follow=True)
    assert "pelo menos um item" in resposta.content.decode()


def test_fechar_nota_continua(logado, cliente, usuario):
    nota = nota_continua_aberta(cliente, usuario)
    assert _post(logado, nota, "fechar/")["Location"] == "/notas/1-1/"
    nota.refresh_from_db()
    assert nota.situacao == S.FECHADA


def test_descartar_rascunho_volta_para_o_cliente(logado, cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    assert _post(logado, nota, "descartar/")["Location"] == "/clientes/1/"
    assert not Nota.objects.exists()


def test_versao_antiga_mostra_aviso_e_nao_altera(logado, cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    versao_antiga = nota.versao
    _post(logado, nota, "itens/", ITEM)
    resposta = logado.post("/notas/1-1/itens/", {"versao": versao_antiga, **ITEM}, follow=True)
    assert "alterada no outro caixa" in resposta.content.decode()
    assert nota.itens.count() == 1


def test_acao_sem_versao_e_tratada_como_conflito(logado, cliente, usuario):
    criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    resposta = logado.post("/notas/1-1/finalizar/", follow=True)
    assert "alterada no outro caixa" in resposta.content.decode()


def test_acoes_exigem_post(logado, cliente, usuario):
    criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    assert logado.get("/notas/1-1/finalizar/").status_code == 405


def test_botoes_do_rascunho(logado, cliente, usuario):
    criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    html = logado.get("/notas/1-1/").content.decode()
    assert "Adicionar item" in html
    assert "Finalizar e imprimir" in html
    assert "Descartar" in html
    assert "Fechar nota" not in html


def test_botoes_da_continua_aberta(logado, cliente, usuario):
    nota_continua_aberta(cliente, usuario)
    html = logado.get("/notas/1-1/").content.decode()
    assert "Adicionar item" in html
    assert "Fechar nota" in html
    assert "Finalizar e imprimir" not in html
    assert "Remover" not in html


def test_botoes_da_nota_fechada(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario)
    html = logado.get("/notas/1-1/").content.decode()
    assert "Adicionar item" not in html
    assert "Finalizar e imprimir" not in html
    assert "Reimprimir" in html


def test_impressao_tem_duas_vias_codigo_e_assinatura(logado, cliente, usuario, settings):
    settings.LOJA_NOME = "Bell Rações"
    nota_unica_fechada(cliente, usuario, "100.00")
    html = logado.get("/notas/1-1/imprimir/").content.decode()
    assert "VIA DO CLIENTE" in html
    assert "VIA DA LOJA" in html
    assert html.count("01-01") >= 2
    assert "Bell Rações" in html
    assert "Maria da Silva" in html
    assert "Ração 15kg" in html
    assert "100,00" in html
    assert "Assinatura" in html
    assert "size: 80mm auto" in html
    assert "window.print()" in html
    assert "EDITADO" not in html


def test_rascunho_nao_imprime(logado, cliente, usuario):
    criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    resposta = logado.get("/notas/1-1/imprimir/", follow=True)
    assert "Finalize a nota antes de imprimir." in resposta.content.decode()
