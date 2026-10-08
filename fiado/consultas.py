from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from fiado.models import CENTAVO, ItemNota, Nota, Pagamento, normalizar

S = Nota.Situacao
EM_DIVIDA = [S.ABERTA, S.FECHADA]
PRAZO_DIAS = 7
ZERO = Decimal("0.00")
MINIMO_SUGESTAO = 2


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


def continuas_abertas(clientes):
    """A nota contínua aberta de cada cliente da lista e o saldo dela, em três consultas.

    Devolve {cliente_id: (nota, saldo)}; cliente sem contínua aberta fica de fora.
    """
    notas = list(
        Nota.objects.filter(
            cliente__in=clientes, tipo=Nota.Tipo.CONTINUA, situacao=S.ABERTA
        ).select_related("cliente")
    )
    ids = [nota.id for nota in notas]
    comprado = dict(
        ItemNota.objects.filter(nota__in=ids)
        .order_by()
        .values_list("nota_id")
        .annotate(total=Sum("subtotal"))
    )
    pago = dict(
        Pagamento.objects.filter(nota__in=ids)
        .order_by()
        .values_list("nota_id")
        .annotate(total=Sum("valor"))
    )
    return {
        nota.cliente_id: (
            nota,
            ((comprado.get(nota.id) or ZERO) - (pago.get(nota.id) or ZERO)).quantize(CENTAVO),
        )
        for nota in notas
    }


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


def rascunhos():
    return Nota.objects.filter(situacao=S.RASCUNHO).select_related("cliente").order_by(
        "criada_em", "numero"
    )


def descricoes_sugeridas(termo, limite):
    """Descrições já lançadas em que alguma palavra começa com o termo, as mais usadas primeiro.

    Grafias que só diferem em acento ou maiúscula contam juntas e aparecem na forma mais usada.
    """
    termo = normalizar(termo or "")
    if len(termo) < MINIMO_SUGESTAO:
        return []
    grupos = {}
    for descricao, usos in ItemNota.objects.order_by().values_list("descricao").annotate(usos=Count("id")):
        chave = normalizar(descricao)
        if chave.startswith(termo) or f" {termo}" in chave:
            grupos.setdefault(chave, []).append((usos, descricao))
    ordenados = sorted(grupos.items(), key=lambda par: (-sum(usos for usos, _ in par[1]), par[0]))
    return [max(grafias, key=lambda g: (g[0], g[1]))[1] for _, grafias in ordenados[:limite]]
