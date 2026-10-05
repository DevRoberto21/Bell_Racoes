from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from fiado.erros import ConflitoDeVersao, ErroDeRegra
from fiado.models import Nota, Pagamento
from fiado.servicos.notas import criar_nota
from fiado.servicos.pagamentos import distribuir, pagar_divida_total, registrar_pagamento
from fiado.tests.fabrica import nota_continua_aberta, nota_unica_fechada

pytestmark = pytest.mark.django_db
S = Nota.Situacao
PIX, DINHEIRO = Pagamento.Forma.PIX, Pagamento.Forma.DINHEIRO


def _pagar(nota, usuario, valor, forma=PIX):
    return registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal(valor), forma=forma, usuario=usuario
    )


def test_pagamento_parcial_reduz_o_saldo(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, valor="100.00")
    pagamento = _pagar(nota, usuario, "40.00", DINHEIRO)
    assert pagamento.nota.saldo == Decimal("60.00")
    assert pagamento.nota.situacao == S.FECHADA
    assert pagamento.forma == DINHEIRO
    assert pagamento.recebido_por == usuario
    assert pagamento.lote is None


def test_pagamento_total_quita_a_nota(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, valor="100.00")
    nota = _pagar(nota, usuario, "40.00").nota
    nota = _pagar(nota, usuario, "60.00").nota
    assert nota.situacao == S.QUITADA
    assert nota.quitada_em is not None


@pytest.mark.parametrize("valor", ["100.01", "0", "-5.00", "0.004", "99.999", "NaN"])
def test_valor_invalido_e_bloqueado(cliente, usuario, valor):
    nota = nota_unica_fechada(cliente, usuario, valor="100.00")
    with pytest.raises(ErroDeRegra):
        _pagar(nota, usuario, valor)
    assert nota.pagamentos.count() == 0


def test_continua_aberta_paga_inteira_continua_aberta(cliente, usuario):
    nota = nota_continua_aberta(cliente, usuario, valor="100.00")
    nota = _pagar(nota, usuario, "100.00").nota
    assert nota.situacao == S.ABERTA
    assert nota.saldo == Decimal("0.00")


def test_rascunho_e_quitada_nao_recebem_pagamento(cliente, usuario):
    rascunho = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    with pytest.raises(ErroDeRegra):
        _pagar(rascunho, usuario, "10.00")
    quitada = _pagar(nota_unica_fechada(cliente, usuario, valor="50.00"), usuario, "50.00").nota
    with pytest.raises(ErroDeRegra):
        _pagar(quitada, usuario, "1.00")


def test_registrar_pagamento_rejeita_forma_invalida(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, valor="100.00")
    with pytest.raises(ErroDeRegra):
        registrar_pagamento(
            nota=nota, versao=nota.versao, valor=Decimal("10.00"), forma="CHEQUE", usuario=usuario
        )
    assert Pagamento.objects.count() == 0


def test_pagamento_com_versao_antiga_e_recusado(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, valor="100.00")
    versao_antiga = nota.versao
    _pagar(nota, usuario, "80.00")
    with pytest.raises(ConflitoDeVersao):
        registrar_pagamento(
            nota=nota, versao=versao_antiga, valor=Decimal("80.00"), forma=PIX, usuario=usuario
        )
    assert nota.pagamentos.count() == 1


def _tres_notas(cliente, usuario):
    agora = timezone.now()
    antiga = nota_unica_fechada(cliente, usuario, "50.00", criada_em=agora - timedelta(days=20))
    media = nota_continua_aberta(cliente, usuario, "80.00", criada_em=agora - timedelta(days=10))
    nova = nota_unica_fechada(cliente, usuario, "30.00", criada_em=agora - timedelta(days=1))
    return antiga, media, nova


def test_distribuir_vai_da_mais_antiga_para_a_mais_recente(cliente, usuario):
    antiga, media, nova = _tres_notas(cliente, usuario)
    partes, sobra = distribuir(cliente, Decimal("100.00"))
    assert [(n.pk, v) for n, v in partes] == [
        (antiga.pk, Decimal("50.00")),
        (media.pk, Decimal("50.00")),
    ]
    assert sobra == Decimal("0.00")
    # Total debt from _tres_notas is 50.00 + 80.00 + 30.00 = 160.00


def test_distribuir_ignora_rascunho_e_nota_sem_saldo(cliente, usuario):
    criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    paga = nota_unica_fechada(cliente, usuario, "20.00")
    _pagar(paga, usuario, "20.00")
    devendo = nota_unica_fechada(cliente, usuario, "30.00")
    partes, sobra = distribuir(cliente, Decimal("40.00"))
    assert [(n.pk, v) for n, v in partes] == [(devendo.pk, Decimal("30.00"))]
    assert sobra == Decimal("10.00")


def test_pagar_divida_total_gera_um_pagamento_por_nota_no_mesmo_lote(cliente, usuario):
    antiga, media, nova = _tres_notas(cliente, usuario)
    pagamentos = pagar_divida_total(
        cliente=cliente, valor=Decimal("100.00"), forma=DINHEIRO, usuario=usuario, divida_esperada=Decimal("160.00")
    )
    assert [(p.nota_id, p.valor) for p in pagamentos] == [
        (antiga.pk, Decimal("50.00")),
        (media.pk, Decimal("50.00")),
    ]
    assert len({p.lote for p in pagamentos}) == 1
    assert pagamentos[0].lote is not None
    antiga.refresh_from_db()
    media.refresh_from_db()
    nova.refresh_from_db()
    assert antiga.situacao == S.QUITADA
    assert media.situacao == S.ABERTA
    assert media.saldo == Decimal("30.00")
    assert nova.saldo == Decimal("30.00")


def test_pagar_divida_total_sobe_a_versao_das_notas_abatidas(cliente, usuario):
    antiga, media, nova = _tres_notas(cliente, usuario)
    versoes = (antiga.versao, nova.versao)
    pagar_divida_total(cliente=cliente, valor=Decimal("50.00"), forma=PIX, usuario=usuario, divida_esperada=Decimal("160.00"))
    antiga.refresh_from_db()
    nova.refresh_from_db()
    assert antiga.versao == versoes[0] + 1
    assert nova.versao == versoes[1]


@pytest.mark.parametrize("valor", ["160.01", "0", "-1", "0.004", "99.999", "NaN"])
def test_pagar_divida_total_bloqueia_valor_invalido(cliente, usuario, valor):
    _tres_notas(cliente, usuario)
    with pytest.raises(ErroDeRegra):
        pagar_divida_total(cliente=cliente, valor=Decimal(valor), forma=PIX, usuario=usuario, divida_esperada=Decimal("160.00"))
    assert Pagamento.objects.count() == 0


def test_pagar_divida_total_rejeita_forma_invalida(cliente, usuario):
    _tres_notas(cliente, usuario)
    with pytest.raises(ErroDeRegra):
        pagar_divida_total(cliente=cliente, valor=Decimal("100.00"), forma="CHEQUE", usuario=usuario, divida_esperada=Decimal("160.00"))
    assert Pagamento.objects.count() == 0


def test_pagar_divida_total_detecta_divida_alterada_no_outro_caixa(cliente, usuario):
    antiga, media, nova = _tres_notas(cliente, usuario)
    # First payment reduces debt from 160.00 to 150.00
    _pagar(antiga, usuario, "10.00")
    # Then try to pay with the old expected debt
    with pytest.raises(ConflitoDeVersao):
        pagar_divida_total(cliente=cliente, valor=Decimal("50.00"), forma=PIX, usuario=usuario, divida_esperada=Decimal("160.00"))
    # Only the first payment should have been recorded
    assert Pagamento.objects.count() == 1


def test_pagar_divida_total_paga_dívida_total_exata(cliente, usuario):
    antiga, media, nova = _tres_notas(cliente, usuario)
    pagamentos = pagar_divida_total(
        cliente=cliente, valor=Decimal("160.00"), forma=DINHEIRO, usuario=usuario, divida_esperada=Decimal("160.00")
    )
    assert len(pagamentos) == 3
    antiga.refresh_from_db()
    media.refresh_from_db()
    nova.refresh_from_db()
    assert antiga.situacao == S.QUITADA
    assert media.situacao == S.ABERTA
    assert media.saldo == Decimal("0.00")
    assert nova.situacao == S.QUITADA
