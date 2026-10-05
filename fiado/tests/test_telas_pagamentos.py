from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from fiado.models import Nota, Pagamento
from fiado.servicos.pagamentos import registrar_pagamento
from fiado.tests.fabrica import nota_unica_fechada

pytestmark = pytest.mark.django_db


def _pagar(logado, nota, valor, forma="DINHEIRO", **extra):
    nota.refresh_from_db()
    return logado.post(
        f"/notas/1-{nota.numero}/pagamento/",
        {"versao": nota.versao, "valor": valor, "forma": forma},
        **extra,
    )


def test_janela_de_pagamento_vem_com_o_saldo(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "100.00")
    html = logado.get("/notas/1-1/").content.decode()
    assert "Confirmar pagamento" in html
    assert 'name="valor" value="100,00"' in html


def test_pagamento_parcial_leva_ao_recibo(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _pagar(logado, nota, "40,00")
    pagamento = Pagamento.objects.get()
    assert resposta["Location"] == f"/recibos/{pagamento.id}/"
    assert pagamento.valor == Decimal("40.00")
    assert pagamento.forma == "DINHEIRO"
    assert pagamento.recebido_por == usuario


def test_recibo_mostra_valor_forma_e_saldo_restante(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    _pagar(logado, nota, "40,00", "PIX")
    html = logado.get(f"/recibos/{Pagamento.objects.get().id}/").content.decode()
    assert "RECIBO DE PAGAMENTO" in html
    assert "01-01" in html
    assert "Maria da Silva" in html
    assert "40,00" in html
    assert "Pix" in html
    assert "Saldo restante" in html
    assert "60,00" in html
    assert 'href="/notas/1-1/"' in html
    assert "Saldo restante da nota em " + timezone.localdate().strftime("%d/%m/%Y") in html


def test_recibo_reaberto_mostra_saldo_atual_com_data(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    _pagar(logado, nota, "40,00")
    primeiro = Pagamento.objects.get()
    nota.refresh_from_db()
    registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal("10.00"), forma="DINHEIRO", usuario=usuario
    )
    html = logado.get(f"/recibos/{primeiro.id}/").content.decode()
    assert "50,00" in html
    assert "Saldo restante da nota em " + timezone.localdate().strftime("%d/%m/%Y") in html


def test_pagamento_acima_do_saldo_mostra_erro(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _pagar(logado, nota, "100,01", follow=True)
    assert "maior que o saldo" in resposta.content.decode()
    assert not Pagamento.objects.exists()


def test_valor_invalido_mostra_erro(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    resposta = _pagar(logado, nota, "abc", follow=True)
    assert "Confira o valor e a forma de pagamento." in resposta.content.decode()
    assert not Pagamento.objects.exists()


def test_quitar_esconde_o_botao_de_pagamento(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    _pagar(logado, nota, "100,00")
    nota.refresh_from_db()
    assert nota.situacao == Nota.Situacao.QUITADA
    html = logado.get("/notas/1-1/").content.decode()
    assert "Confirmar pagamento" not in html
    assert "Quitada" in html


def _duas_notas(cliente, usuario):
    agora = timezone.now()
    antiga = nota_unica_fechada(cliente, usuario, "50.00", criada_em=agora - timedelta(days=10))
    nova = nota_unica_fechada(cliente, usuario, "80.00", criada_em=agora - timedelta(days=2))
    return antiga, nova


def test_registro_do_cliente_tem_botao_de_divida_total(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    assert "Pagar dívida total" in logado.get("/clientes/1/").content.decode()


def test_tela_de_divida_total_vem_com_a_divida(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    html = logado.get("/clientes/1/pagar/").content.decode()
    assert 'value="130,00"' in html
    assert "01-01" in html and "01-02" in html


def test_tela_de_divida_total_leva_a_divida_em_campo_oculto(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    html = logado.get("/clientes/1/pagar/").content.decode()
    assert 'name="divida" value="130,00"' in html


def test_previa_mostra_a_distribuicao(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    html = logado.get("/clientes/1/pagar/previa/", {"valor": "70,00"}).content.decode()
    assert "01-01" in html and "50,00" in html
    assert "01-02" in html and "20,00" in html
    assert "<html" not in html


def test_previa_avisa_quando_o_valor_passa_da_divida(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    html = logado.get("/clientes/1/pagar/previa/", {"valor": "200,00"}).content.decode()
    assert "maior que a dívida" in html


def test_pagar_divida_total_leva_ao_recibo_do_lote(logado, cliente, usuario):
    antiga, nova = _duas_notas(cliente, usuario)
    resposta = logado.post(
        "/clientes/1/pagar/", {"valor": "70,00", "forma": "PIX", "divida": "130,00"}
    )
    pagamentos = list(Pagamento.objects.order_by("id"))
    assert [(p.nota_id, p.valor) for p in pagamentos] == [
        (antiga.pk, Decimal("50.00")),
        (nova.pk, Decimal("20.00")),
    ]
    assert resposta["Location"] == f"/recibos/lote/{pagamentos[0].lote}/"


def test_recibo_do_lote_lista_as_notas_e_a_divida_restante(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    logado.post("/clientes/1/pagar/", {"valor": "70,00", "forma": "PIX", "divida": "130,00"})
    lote = Pagamento.objects.first().lote
    html = logado.get(f"/recibos/lote/{lote}/").content.decode()
    assert html.count("RECIBO DE PAGAMENTO") == 1
    assert "01-01" in html and "01-02" in html
    assert "70,00" in html
    assert "60,00" in html
    assert 'href="/clientes/1/"' in html
    assert "Saldo restante do cliente em " + timezone.localdate().strftime("%d/%m/%Y") in html


def test_divida_total_acima_da_divida_mostra_erro(logado, cliente, usuario):
    _duas_notas(cliente, usuario)
    resposta = logado.post(
        "/clientes/1/pagar/", {"valor": "130,01", "forma": "PIX", "divida": "130,00"}
    )
    assert resposta.status_code == 200
    assert "maior que a dívida" in resposta.content.decode()
    assert not Pagamento.objects.exists()


def test_divida_alterada_no_outro_caixa_bloqueia_e_atualiza_a_tela(logado, cliente, usuario):
    antiga, _ = _duas_notas(cliente, usuario)
    antiga.refresh_from_db()
    registrar_pagamento(
        nota=antiga, versao=antiga.versao, valor=Decimal("10.00"), forma="DINHEIRO", usuario=usuario
    )
    resposta = logado.post(
        "/clientes/1/pagar/", {"valor": "70,00", "forma": "PIX", "divida": "130,00"}
    )
    html = resposta.content.decode()
    assert resposta.status_code == 200
    assert "mudou no outro caixa" in html
    assert Pagamento.objects.count() == 1
    assert 'name="divida" value="120,00"' in html


def test_recibo_inexistente_e_404(logado):
    assert logado.get("/recibos/999/").status_code == 404
    assert logado.get("/recibos/lote/00000000-0000-0000-0000-000000000000/").status_code == 404
