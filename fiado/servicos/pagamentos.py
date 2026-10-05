import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from fiado.erros import ErroDeRegra
from fiado.models import Nota, Pagamento
from fiado.servicos.versao import gravar, quitar_se_zerou, travar

S = Nota.Situacao
ZERO = Decimal("0.00")


def _lancar(nota, valor, forma, usuario, agora, lote=None):
    pagamento = Pagamento.objects.create(
        nota=nota, valor=valor, forma=forma, recebido_em=agora, recebido_por=usuario, lote=lote
    )
    gravar(nota)
    quitar_se_zerou(nota, agora)
    return pagamento


@transaction.atomic
def registrar_pagamento(*, nota, versao, valor, forma, usuario, agora=None):
    agora = agora or timezone.now()
    nota = travar(nota, versao)
    if not nota.em_divida:
        raise ErroDeRegra("Esta nota não recebe pagamento.")
    if forma not in Pagamento.Forma.values:
        raise ErroDeRegra("Forma de pagamento inválida.")
    if valor <= ZERO:
        raise ErroDeRegra("O valor do pagamento deve ser maior que zero.")
    if valor > nota.saldo:
        raise ErroDeRegra("O valor do pagamento é maior que o saldo da nota.")
    return _lancar(nota, valor, forma, usuario, agora)


def distribuir(cliente, valor):
    """Divide o valor pelas notas com saldo, da mais antiga para a mais recente."""
    notas = (
        cliente.notas.filter(situacao__in=[S.ABERTA, S.FECHADA])
        .select_related("cliente")
        .order_by("criada_em", "numero")
    )
    partes, restante = [], valor
    for nota in notas:
        if restante <= ZERO:
            break
        saldo = nota.saldo
        if saldo <= ZERO:
            continue
        parte = min(restante, saldo)
        partes.append((nota, parte))
        restante -= parte
    return partes, max(restante, ZERO)


@transaction.atomic
def pagar_divida_total(*, cliente, valor, forma, usuario, agora=None):
    agora = agora or timezone.now()
    if forma not in Pagamento.Forma.values:
        raise ErroDeRegra("Forma de pagamento inválida.")
    if valor <= ZERO:
        raise ErroDeRegra("O valor do pagamento deve ser maior que zero.")
    partes, sobra = distribuir(cliente, valor)
    if sobra > ZERO:
        raise ErroDeRegra("O valor é maior que a dívida do cliente.")
    lote = uuid.uuid4()
    return [_lancar(nota, parte, forma, usuario, agora, lote) for nota, parte in partes]
