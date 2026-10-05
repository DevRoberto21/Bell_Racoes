import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from fiado.erros import ConflitoDeVersao, ErroDeRegra
from fiado.models import Nota, Pagamento
from fiado.servicos.versao import gravar, quitar_se_zerou, travar

S = Nota.Situacao
ZERO = Decimal("0.00")


def _validar(valor, forma):
    """Valida forma e valor do pagamento."""
    if forma not in Pagamento.Forma.values:
        raise ErroDeRegra("Forma de pagamento inválida.")
    if not valor.is_finite():
        raise ErroDeRegra("Valor de pagamento inválido.")
    if valor != valor.quantize(Decimal("0.01")):
        raise ErroDeRegra("Valor de pagamento inválido.")
    if valor <= ZERO:
        raise ErroDeRegra("O valor do pagamento deve ser maior que zero.")


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
    _validar(valor, forma)
    nota = travar(nota, versao)
    if not nota.em_divida:
        raise ErroDeRegra("Esta nota não recebe pagamento.")
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
def pagar_divida_total(*, cliente, valor, forma, usuario, divida_esperada, agora=None):
    agora = agora or timezone.now()
    _validar(valor, forma)

    # Check if the debt has changed since the screen was shown
    divida_atual = sum(
        nota.saldo
        for nota in cliente.notas.filter(situacao__in=[S.ABERTA, S.FECHADA])
    )
    if divida_atual != divida_esperada:
        raise ConflitoDeVersao("A dívida deste cliente mudou no outro caixa. A tela foi atualizada; confira e repita.")

    partes, sobra = distribuir(cliente, valor)
    if sobra > ZERO:
        raise ErroDeRegra("O valor é maior que a dívida do cliente.")
    lote = uuid.uuid4()
    return [_lancar(nota, parte, forma, usuario, agora, lote) for nota, parte in partes]
