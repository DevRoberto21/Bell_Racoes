from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.db import IntegrityError, transaction

from fiado.erros import ErroDeRegra
from fiado.models import Cliente, ItemNota, Nota, Pagamento
from fiado.servicos.clientes import criar_cliente, excluir_cliente

pytestmark = pytest.mark.django_db
SP = ZoneInfo("America/Sao_Paulo")


def _nota(cliente, usuario, numero=1, **campos):
    campos.setdefault("tipo", Nota.Tipo.UNICA)
    campos.setdefault("situacao", Nota.Situacao.FECHADA)
    return Nota.objects.create(cliente=cliente, numero=numero, criada_por=usuario, **campos)


def test_codigo_de_cliente_comeca_em_1_e_segue_em_ordem():
    primeiro = criar_cliente(nome="Ana")
    segundo = criar_cliente(nome="Bruno")
    assert (primeiro.codigo, segundo.codigo) == (1, 2)
    assert primeiro.codigo_formatado == "01"


def test_codigo_de_cliente_excluido_nao_e_reaproveitado():
    criar_cliente(nome="Ana")
    bruno = criar_cliente(nome="Bruno")
    excluir_cliente(bruno)
    carla = criar_cliente(nome="Carla")
    assert carla.codigo == 3


def test_codigo_formatado_com_tres_digitos():
    assert Cliente(codigo=105).codigo_formatado == "105"


def test_clientes_em_ordem_alfabetica_ignorando_acento_e_caixa():
    for nome in ["Zeca", "ávila", "Bruno", "Ana"]:
        criar_cliente(nome=nome)
    assert [c.nome for c in Cliente.objects.all()] == ["Ana", "ávila", "Bruno", "Zeca"]


def test_cliente_com_nota_nao_pode_ser_excluido(cliente, usuario):
    _nota(cliente, usuario)
    with pytest.raises(ErroDeRegra):
        excluir_cliente(cliente)
    assert Cliente.objects.filter(pk=cliente.pk).exists()


def test_codigo_da_nota(cliente, usuario):
    assert _nota(cliente, usuario, numero=3).codigo == "01-03"


def test_subtotal_do_item_e_arredondado_no_item(cliente, usuario):
    nota = _nota(cliente, usuario)
    item = ItemNota.objects.create(
        nota=nota,
        descricao="Ração a granel",
        quantidade=Decimal("1.335"),
        preco_unitario=Decimal("9.99"),
        adicionado_por=usuario,
    )
    assert item.subtotal == Decimal("13.34")


def test_total_pago_e_saldo(cliente, usuario):
    nota = _nota(cliente, usuario)
    for quantidade, preco in [("2", "50.00"), ("1", "25.50")]:
        ItemNota.objects.create(
            nota=nota,
            descricao="Item",
            quantidade=Decimal(quantidade),
            preco_unitario=Decimal(preco),
            adicionado_por=usuario,
        )
    Pagamento.objects.create(
        nota=nota, valor=Decimal("40.00"), forma=Pagamento.Forma.PIX, recebido_por=usuario
    )
    assert nota.total == Decimal("125.50")
    assert nota.total_pago == Decimal("40.00")
    assert nota.saldo == Decimal("85.50")


def test_nota_sem_itens_tem_total_zero(cliente, usuario):
    nota = _nota(cliente, usuario)
    assert nota.total == Decimal("0.00")
    assert nota.saldo == Decimal("0.00")


@pytest.mark.parametrize(
    "dias, nivel", [(0, 0), (6, 0), (7, 1), (13, 1), (14, 2), (21, 3)]
)
def test_dias_em_aberto_e_nivel_de_alerta(cliente, usuario, dias, nivel):
    nota = _nota(cliente, usuario, criada_em=datetime(2026, 10, 1, 23, 30, tzinfo=SP))
    hoje = date(2026, 10, 1 + dias)
    assert nota.dias_em_aberto(hoje) == dias
    assert nota.nivel_alerta(hoje) == nivel


def test_numero_de_nota_e_unico_por_cliente(cliente, usuario):
    _nota(cliente, usuario, numero=1)
    with pytest.raises(IntegrityError), transaction.atomic():
        _nota(cliente, usuario, numero=1)


def test_banco_recusa_duas_continuas_abertas_do_mesmo_cliente(cliente, usuario):
    _nota(cliente, usuario, numero=1, tipo=Nota.Tipo.CONTINUA, situacao=Nota.Situacao.ABERTA)
    with pytest.raises(IntegrityError), transaction.atomic():
        _nota(cliente, usuario, numero=2, tipo=Nota.Tipo.CONTINUA, situacao=Nota.Situacao.ABERTA)


def test_aceita_itens_e_em_divida(cliente, usuario):
    S, T = Nota.Situacao, Nota.Tipo
    rascunho = Nota(tipo=T.UNICA, situacao=S.RASCUNHO)
    aberta = Nota(tipo=T.CONTINUA, situacao=S.ABERTA)
    fechada = Nota(tipo=T.UNICA, situacao=S.FECHADA)
    quitada = Nota(tipo=T.UNICA, situacao=S.QUITADA)
    assert [n.aceita_itens for n in (rascunho, aberta, fechada, quitada)] == [True, True, False, False]
    assert [n.em_divida for n in (rascunho, aberta, fechada, quitada)] == [False, True, True, False]
