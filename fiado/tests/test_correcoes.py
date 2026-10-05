from decimal import Decimal

import pytest

from fiado.erros import ConflitoDeVersao, ErroDeRegra
from fiado.models import Nota
from fiado.servicos.correcoes import corrigir_nota
from fiado.servicos.notas import criar_nota
from fiado.servicos.pagamentos import registrar_pagamento
from fiado.tests.fabrica import nota_continua_aberta, nota_unica_fechada

pytestmark = pytest.mark.django_db
S = Nota.Situacao


def _itens(*pares):
    return [
        {"descricao": d, "quantidade": Decimal("1"), "preco_unitario": Decimal(p)} for d, p in pares
    ]


def _pagar(nota, usuario, valor):
    return registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal(valor), forma="PIX", usuario=usuario
    ).nota


def test_correcao_troca_os_itens_e_marca_como_editada(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, valor="100.00")
    correcao = corrigir_nota(
        nota=nota,
        versao=nota.versao,
        itens=_itens(("Ração 10kg", "70.00"), ("Coleira", "15.00")),
        usuario=usuario,
    )
    nota = correcao.nota
    assert nota.editada is True
    assert nota.editada_em is not None
    assert nota.total == Decimal("85.00")
    assert [i.descricao for i in nota.itens.all()] == ["Ração 10kg", "Coleira"]
    assert nota.situacao == S.FECHADA


def test_correcao_guarda_a_versao_anterior(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, valor="100.00")
    correcao = corrigir_nota(
        nota=nota, versao=nota.versao, itens=_itens(("Ração 10kg", "70.00")), usuario=usuario
    )
    assert correcao.feita_por == usuario
    assert correcao.total_anterior == Decimal("100.00")
    assert len(correcao.itens_anteriores) == 1
    anterior = correcao.itens_anteriores[0]
    assert anterior["descricao"] == "Ração 15kg"
    assert anterior["quantidade"] == "1.000"
    assert anterior["preco_unitario"] == "100.00"
    assert anterior["subtotal"] == "100.00"


def test_duas_correcoes_guardam_dois_historicos(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, valor="100.00")
    nota = corrigir_nota(
        nota=nota, versao=nota.versao, itens=_itens(("A", "90.00")), usuario=usuario
    ).nota
    corrigir_nota(nota=nota, versao=nota.versao, itens=_itens(("B", "80.00")), usuario=usuario)
    assert [c.total_anterior for c in nota.correcoes.all()] == [Decimal("100.00"), Decimal("90.00")]


def test_correcao_nao_pode_ficar_abaixo_do_que_ja_foi_pago(cliente, usuario):
    nota = _pagar(nota_unica_fechada(cliente, usuario, valor="100.00"), usuario, "60.00")
    with pytest.raises(ErroDeRegra, match="abaixo do valor já pago"):
        corrigir_nota(
            nota=nota, versao=nota.versao, itens=_itens(("Ração", "59.99")), usuario=usuario
        )
    nota.refresh_from_db()
    assert nota.editada is False
    assert nota.total == Decimal("100.00")
    assert nota.correcoes.count() == 0


def test_correcao_que_iguala_o_valor_pago_quita_a_nota(cliente, usuario):
    nota = _pagar(nota_unica_fechada(cliente, usuario, valor="100.00"), usuario, "60.00")
    nota = corrigir_nota(
        nota=nota, versao=nota.versao, itens=_itens(("Ração", "60.00")), usuario=usuario
    ).nota
    assert nota.situacao == S.QUITADA
    assert nota.quitada_em is not None


def test_correcao_nao_altera_pagamentos(cliente, usuario):
    nota = _pagar(nota_unica_fechada(cliente, usuario, valor="100.00"), usuario, "60.00")
    nota = corrigir_nota(
        nota=nota, versao=nota.versao, itens=_itens(("Ração", "90.00")), usuario=usuario
    ).nota
    assert nota.total_pago == Decimal("60.00")
    assert nota.saldo == Decimal("30.00")


def test_continua_aberta_pode_ser_corrigida_e_continua_aberta(cliente, usuario):
    nota = nota_continua_aberta(cliente, usuario, valor="100.00")
    nota = corrigir_nota(
        nota=nota, versao=nota.versao, itens=_itens(("Ração", "40.00")), usuario=usuario
    ).nota
    assert nota.situacao == S.ABERTA
    assert nota.editada is True


def test_rascunho_e_quitada_nao_tem_correcao(cliente, usuario):
    rascunho = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    with pytest.raises(ErroDeRegra):
        corrigir_nota(
            nota=rascunho, versao=rascunho.versao, itens=_itens(("A", "1.00")), usuario=usuario
        )
    quitada = _pagar(nota_unica_fechada(cliente, usuario, valor="50.00"), usuario, "50.00")
    with pytest.raises(ErroDeRegra):
        corrigir_nota(
            nota=quitada, versao=quitada.versao, itens=_itens(("A", "50.00")), usuario=usuario
        )


def test_correcao_exige_pelo_menos_um_item_valido(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario)
    with pytest.raises(ErroDeRegra, match="pelo menos um item"):
        corrigir_nota(nota=nota, versao=nota.versao, itens=[], usuario=usuario)
    with pytest.raises(ErroDeRegra):
        corrigir_nota(nota=nota, versao=nota.versao, itens=_itens(("A", "0")), usuario=usuario)


def test_correcao_com_versao_antiga_e_recusada(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, valor="100.00")
    versao_antiga = nota.versao
    _pagar(nota, usuario, "10.00")
    with pytest.raises(ConflitoDeVersao):
        corrigir_nota(
            nota=nota, versao=versao_antiga, itens=_itens(("A", "90.00")), usuario=usuario
        )
