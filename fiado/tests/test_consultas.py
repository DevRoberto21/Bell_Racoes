from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from fiado import consultas
from fiado.models import Nota
from fiado.servicos.clientes import criar_cliente
from fiado.servicos.notas import criar_nota
from fiado.servicos.pagamentos import registrar_pagamento
from fiado.tests.fabrica import nota_continua_aberta, nota_unica_fechada

pytestmark = pytest.mark.django_db
SP = ZoneInfo("America/Sao_Paulo")
HOJE = date(2026, 10, 30)


def _ha(dias):
    return datetime(2026, 10, 30, 9, 0, tzinfo=SP) - timedelta(days=dias)


def _pagar(nota, usuario, valor, agora=None):
    return registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal(valor), forma="PIX", usuario=usuario, agora=agora
    ).nota


def test_divida_do_cliente_soma_saldos_e_ignora_rascunho_e_quitada(cliente, usuario):
    _pagar(nota_unica_fechada(cliente, usuario, "100.00"), usuario, "30.00")
    nota_continua_aberta(cliente, usuario, "50.00")
    _pagar(nota_unica_fechada(cliente, usuario, "20.00"), usuario, "20.00")
    criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    assert consultas.divida_do_cliente(cliente) == Decimal("120.00")
    assert consultas.dividas_por_cliente() == {cliente.id: Decimal("120.00")}
    assert consultas.total_em_aberto() == Decimal("120.00")


def test_dividas_por_cliente_separa_os_clientes(cliente, usuario):
    outro = criar_cliente(nome="João")
    nota_unica_fechada(cliente, usuario, "100.00")
    nota_unica_fechada(outro, usuario, "40.00")
    assert consultas.dividas_por_cliente() == {
        cliente.id: Decimal("100.00"),
        outro.id: Decimal("40.00"),
    }
    assert consultas.total_em_aberto() == Decimal("140.00")


def test_notas_abertas_por_cliente_conta_as_nao_quitadas(cliente, usuario):
    nota_unica_fechada(cliente, usuario, "100.00")
    criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    _pagar(nota_unica_fechada(cliente, usuario, "20.00"), usuario, "20.00")
    assert consultas.notas_abertas_por_cliente() == {cliente.id: 2}


def test_notas_em_aberto_da_mais_antiga_para_a_mais_recente(cliente, usuario):
    nova = nota_unica_fechada(cliente, usuario, criada_em=_ha(1))
    antiga = nota_unica_fechada(cliente, usuario, criada_em=_ha(20))
    quitada = _pagar(nota_unica_fechada(cliente, usuario, "10.00", criada_em=_ha(30)), usuario, "10.00")
    em_aberto = list(consultas.notas_em_aberto(cliente))
    assert [n.pk for n in em_aberto] == [antiga.pk, nova.pk]
    assert quitada not in em_aberto


def test_alerta_lista_notas_com_7_dias_ou_mais_da_mais_atrasada(cliente, usuario):
    seis = nota_unica_fechada(cliente, usuario, criada_em=_ha(6))
    sete = nota_unica_fechada(cliente, usuario, criada_em=_ha(7))
    quinze = nota_continua_aberta(cliente, usuario, criada_em=_ha(15))
    alerta = consultas.notas_em_alerta(HOJE)
    assert [n.pk for n in alerta] == [quinze.pk, sete.pk]
    assert [n.nivel_alerta(HOJE) for n in alerta] == [2, 1]
    assert seis not in alerta


def test_alerta_ignora_quitada_rascunho_e_nota_sem_saldo(cliente, usuario):
    _pagar(nota_unica_fechada(cliente, usuario, "10.00", criada_em=_ha(30)), usuario, "10.00")
    rascunho = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    Nota.objects.filter(pk=rascunho.pk).update(criada_em=_ha(30))
    _pagar(nota_continua_aberta(cliente, usuario, "10.00", criada_em=_ha(30)), usuario, "10.00")
    assert consultas.notas_em_alerta(HOJE) == []


def test_alerta_some_quando_a_nota_e_quitada(cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "10.00", criada_em=_ha(10))
    assert [n.pk for n in consultas.notas_em_alerta(HOJE)] == [nota.pk]
    _pagar(nota, usuario, "10.00")
    assert consultas.notas_em_alerta(HOJE) == []


def test_pagas_recentes_mostra_so_os_ultimos_7_dias(cliente, usuario):
    agora = timezone.now()
    recente = _pagar(
        nota_unica_fechada(cliente, usuario, "10.00"), usuario, "10.00", agora=agora - timedelta(days=6)
    )
    antiga = _pagar(
        nota_unica_fechada(cliente, usuario, "10.00"), usuario, "10.00", agora=agora - timedelta(days=8)
    )
    nota_unica_fechada(cliente, usuario, "10.00")
    pagas = list(consultas.notas_pagas_recentes(agora))
    assert [n.pk for n in pagas] == [recente.pk]
    assert Nota.objects.filter(pk=antiga.pk).exists()


def test_rascunhos_lista_so_rascunhos_em_ordem(cliente, usuario):
    primeiro = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    segundo = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    nota_unica_fechada(cliente, usuario, "10.00")
    nota_continua_aberta(criar_cliente(nome="Outro"), usuario)
    assert list(consultas.rascunhos()) == [primeiro, segundo]
