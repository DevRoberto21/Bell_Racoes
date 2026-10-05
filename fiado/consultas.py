from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from fiado.models import CENTAVO, ItemNota, Nota, Pagamento

S = Nota.Situacao
EM_DIVIDA = [S.ABERTA, S.FECHADA]
PRAZO_DIAS = 7
ZERO = Decimal("0.00")


def divida_do_cliente(cliente):
    return sum((nota.saldo for nota in cliente.notas.filter(situacao__in=EM_DIVIDA)), ZERO)


def dividas_por_cliente():
    """Dívida de cada cliente em duas consultas, para a lista de clientes."""
    comprado = dict(
        ItemNota.objects.filter(nota__situacao__in=EM_DIVIDA)
        .order_by()
        .values_list("nota__cliente_id")
        .annotate(total=Sum("subtotal"))
    )
    pago = dict(
        Pagamento.objects.filter(nota__situacao__in=EM_DIVIDA)
        .order_by()
        .values_list("nota__cliente_id")
        .annotate(total=Sum("valor"))
    )
    return {
        cliente_id: (total - (pago.get(cliente_id) or ZERO)).quantize(CENTAVO)
        for cliente_id, total in comprado.items()
    }


def notas_abertas_por_cliente():
    return dict(
        Nota.objects.exclude(situacao=S.QUITADA)
        .order_by()
        .values_list("cliente_id")
        .annotate(quantidade=Count("id"))
    )


def notas_em_aberto(cliente):
    return cliente.notas.exclude(situacao=S.QUITADA).order_by("criada_em", "numero")


def notas_em_alerta(hoje=None):
    hoje = hoje or timezone.localdate()
    notas = Nota.objects.filter(situacao__in=EM_DIVIDA).select_related("cliente")
    atrasadas = [
        nota for nota in notas if nota.dias_em_aberto(hoje) >= PRAZO_DIAS and nota.saldo > ZERO
    ]
    return sorted(atrasadas, key=lambda nota: (-nota.dias_em_aberto(hoje), nota.pk))


def total_em_aberto():
    return sum(dividas_por_cliente().values(), ZERO)


def notas_pagas_recentes(agora=None):
    agora = agora or timezone.now()
    return (
        Nota.objects.filter(situacao=S.QUITADA, quitada_em__gte=agora - timedelta(days=PRAZO_DIAS))
        .select_related("cliente")
        .order_by("-quitada_em")
    )
