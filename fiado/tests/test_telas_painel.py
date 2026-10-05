from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from fiado.servicos.clientes import criar_cliente
from fiado.servicos.pagamentos import registrar_pagamento
from fiado.tests.fabrica import nota_unica_fechada

pytestmark = pytest.mark.django_db


def _ha(dias):
    return timezone.now() - timedelta(days=dias)


def _quitar(nota, usuario, agora=None):
    return registrar_pagamento(
        nota=nota, versao=nota.versao, valor=nota.saldo, forma="PIX", usuario=usuario, agora=agora
    ).nota


def test_painel_lista_notas_atrasadas_da_mais_atrasada(logado, cliente, usuario):
    joao = criar_cliente(nome="João")
    nota_unica_fechada(cliente, usuario, "100.00", criada_em=_ha(8))
    nota_unica_fechada(joao, usuario, "40.00", criada_em=_ha(22))
    nota_unica_fechada(cliente, usuario, "30.00", criada_em=_ha(3))
    html = logado.get("/").content.decode()
    assert html.index("02-01") < html.index("01-01")
    assert "01-02" not in html
    assert "21 dias" in html
    assert "7 dias" in html
    assert "João" in html
    assert 'href="/notas/2-1/"' in html


def test_painel_mostra_total_em_aberto(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "100.00")
    nota_unica_fechada(cliente, usuario, "30.50")
    assert "130,50" in logado.get("/").content.decode()


def test_painel_sem_atraso(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "100.00")
    assert "Nenhuma nota atrasada." in logado.get("/").content.decode()


def test_nota_quitada_sai_do_painel(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00", criada_em=_ha(10))
    assert "01-01" in logado.get("/").content.decode()
    _quitar(nota, usuario)
    assert "01-01" not in logado.get("/").content.decode()


def test_pagas_mostra_os_ultimos_7_dias(logado, cliente, usuario):
    _quitar(nota_unica_fechada(cliente, usuario, "10.00"), usuario, agora=_ha(6))
    _quitar(nota_unica_fechada(cliente, usuario, "20.00"), usuario, agora=_ha(8))
    html = logado.get("/pagas/").content.decode()
    assert "01-01" in html
    assert "01-02" not in html
    assert 'href="/notas/1-1/imprimir/"' in html


def test_nota_paga_antiga_ainda_abre_pelo_codigo(logado, cliente, usuario):
    _quitar(nota_unica_fechada(cliente, usuario, "20.00"), usuario, agora=_ha(30))
    assert logado.get("/busca/", {"q": "01-01"})["Location"] == "/notas/1-1/"
    assert logado.get("/notas/1-1/").status_code == 200


def test_pagas_vazia(logado):
    assert "Nenhuma nota quitada nos últimos 7 dias." in logado.get("/pagas/").content.decode()


def test_menu_tem_contas_pagas(logado):
    assert 'href="/pagas/"' in logado.get("/").content.decode()
