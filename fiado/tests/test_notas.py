from decimal import Decimal

import pytest

from fiado.erros import ConflitoDeVersao, ErroDeRegra
from fiado.models import Nota, Pagamento
from fiado.servicos.notas import (
    adicionar_item,
    criar_nota,
    descartar_nota,
    fechar_nota,
    finalizar_nota,
    remover_item,
)
from fiado.tests.fabrica import nota_continua_aberta, nota_unica_fechada

pytestmark = pytest.mark.django_db
S, T = Nota.Situacao, Nota.Tipo


def _item(nota, usuario, preco="50.00", quantidade="1"):
    return adicionar_item(
        nota=nota,
        versao=nota.versao,
        descricao="Ração",
        quantidade=Decimal(quantidade),
        preco_unitario=Decimal(preco),
        usuario=usuario,
    )


def test_nota_unica_nasce_rascunho_e_continua_nasce_aberta(cliente, usuario):
    unica = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    continua = criar_nota(cliente=cliente, tipo=T.CONTINUA, usuario=usuario)
    assert (unica.situacao, continua.situacao) == (S.RASCUNHO, S.ABERTA)
    assert (unica.codigo, continua.codigo) == ("01-01", "01-02")
    assert unica.criada_por == usuario


def test_numero_de_nota_descartada_nao_e_reaproveitado(cliente, usuario):
    primeira = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    descartar_nota(nota=primeira, versao=primeira.versao)
    segunda = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    assert segunda.numero == 2


def test_so_uma_continua_aberta_por_cliente(cliente, usuario):
    criar_nota(cliente=cliente, tipo=T.CONTINUA, usuario=usuario)
    with pytest.raises(ErroDeRegra, match="já tem uma nota contínua aberta"):
        criar_nota(cliente=cliente, tipo=T.CONTINUA, usuario=usuario)


def test_notas_unicas_nao_tem_limite(cliente, usuario):
    for _ in range(3):
        criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    assert cliente.notas.count() == 3


def test_finalizar_nota_unica(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    nota = _item(nota, usuario)
    nota = finalizar_nota(nota=nota, versao=nota.versao)
    assert nota.situacao == S.FECHADA
    assert nota.fechada_em is not None


def test_nao_finaliza_nota_sem_item(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    with pytest.raises(ErroDeRegra, match="pelo menos um item"):
        finalizar_nota(nota=nota, versao=nota.versao)


def test_nota_unica_fechada_nao_aceita_item(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario)
    with pytest.raises(ErroDeRegra, match="não aceita novos itens"):
        _item(nota, usuario)
    assert nota.itens.count() == 1


def test_rascunho_permite_remover_item(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    nota = _item(nota, usuario)
    nota = remover_item(nota=nota, versao=nota.versao, item_id=nota.itens.get().id)
    assert nota.itens.count() == 0


def test_continua_aberta_nao_permite_remover_item(cliente, usuario):
    nota = nota_continua_aberta(cliente, usuario)
    with pytest.raises(ErroDeRegra, match="botão de correção"):
        remover_item(nota=nota, versao=nota.versao, item_id=nota.itens.get().id)


def test_continua_aberta_aceita_novos_itens(cliente, usuario):
    nota = nota_continua_aberta(cliente, usuario, valor="100.00")
    nota = _item(nota, usuario, preco="30.00")
    assert nota.total == Decimal("130.00")


def test_item_exige_quantidade_e_preco_positivos(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    with pytest.raises(ErroDeRegra):
        _item(nota, usuario, quantidade="0")
    with pytest.raises(ErroDeRegra):
        _item(nota, usuario, preco="0")


def test_fechar_continua_com_saldo_fica_fechada(cliente, usuario):
    nota = nota_continua_aberta(cliente, usuario)
    nota = fechar_nota(nota=nota, versao=nota.versao)
    assert nota.situacao == S.FECHADA
    with pytest.raises(ErroDeRegra, match="não aceita novos itens"):
        _item(nota, usuario)


def test_fechar_continua_ja_paga_vira_quitada(cliente, usuario):
    nota = nota_continua_aberta(cliente, usuario, valor="100.00")
    Pagamento.objects.create(
        nota=nota, valor=Decimal("100.00"), forma=Pagamento.Forma.PIX, recebido_por=usuario
    )
    nota = fechar_nota(nota=nota, versao=nota.versao)
    assert nota.situacao == S.QUITADA
    assert nota.quitada_em is not None


def test_nao_fecha_continua_sem_item(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.CONTINUA, usuario=usuario)
    with pytest.raises(ErroDeRegra, match="pelo menos um item"):
        fechar_nota(nota=nota, versao=nota.versao)


def test_depois_de_fechar_pode_abrir_outra_continua(cliente, usuario):
    primeira = nota_continua_aberta(cliente, usuario)
    fechar_nota(nota=primeira, versao=primeira.versao)
    segunda = criar_nota(cliente=cliente, tipo=T.CONTINUA, usuario=usuario)
    assert segunda.situacao == S.ABERTA


def test_descartar_continua_vazia(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.CONTINUA, usuario=usuario)
    descartar_nota(nota=nota, versao=nota.versao)
    assert not Nota.objects.filter(pk=nota.pk).exists()


def test_nao_descarta_continua_com_item_nem_nota_fechada(cliente, usuario):
    continua = nota_continua_aberta(cliente, usuario)
    with pytest.raises(ErroDeRegra):
        descartar_nota(nota=continua, versao=continua.versao)
    fechada = nota_unica_fechada(cliente, usuario)
    with pytest.raises(ErroDeRegra):
        descartar_nota(nota=fechada, versao=fechada.versao)


def test_versao_sobe_a_cada_alteracao(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    assert nota.versao == 1
    nota = _item(nota, usuario)
    assert nota.versao == 2


def test_versao_antiga_e_recusada(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    versao_da_tela_do_outro_caixa = nota.versao
    _item(nota, usuario)
    with pytest.raises(ConflitoDeVersao):
        adicionar_item(
            nota=nota,
            versao=versao_da_tela_do_outro_caixa,
            descricao="Outro",
            quantidade=Decimal("1"),
            preco_unitario=Decimal("10.00"),
            usuario=usuario,
        )
    assert nota.itens.count() == 1


def test_versao_invalida_e_tratada_como_conflito(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    with pytest.raises(ConflitoDeVersao):
        finalizar_nota(nota=nota, versao="abc")


def test_item_que_arredonda_para_zero_e_recusado(cliente, usuario):
    nota = criar_nota(cliente=cliente, tipo=T.UNICA, usuario=usuario)
    with pytest.raises(ErroDeRegra, match="O valor do item não pode ser zero."):
        adicionar_item(
            nota=nota,
            versao=nota.versao,
            descricao="Grão",
            quantidade=Decimal("0.001"),
            preco_unitario=Decimal("0.01"),
            usuario=usuario,
        )
    assert not nota.itens.exists()
