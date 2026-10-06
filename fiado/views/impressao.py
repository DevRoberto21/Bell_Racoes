from decimal import Decimal

from django.http import Http404
from django.shortcuts import get_object_or_404, render
from django.utils import timezone

from fiado import consultas
from fiado.models import Nota, Pagamento

VIAS = ["VIA DO CLIENTE", "VIA DA LOJA"]


def obter_nota(cliente_codigo, numero):
    return get_object_or_404(
        Nota.objects.select_related("cliente"), cliente__codigo=cliente_codigo, numero=numero
    )


def _contexto(nota):
    return {
        "nota": nota,
        "itens": list(nota.itens.all()),
        "pagamentos": list(nota.pagamentos.all()),
        "total": nota.total,
        "saldo": nota.saldo,
    }


def imprimir_nota(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    if nota.situacao == Nota.Situacao.RASCUNHO:
        raise Http404
    return render(request, "fiado/impressao/nota.html", _contexto(nota) | {"vias": VIAS})


def _recibo(request, pagamentos, saldo_restante, rotulo_saldo):
    primeiro = pagamentos[0]
    contexto = {
        "pagamentos": pagamentos,
        "cliente": primeiro.nota.cliente,
        "primeiro": primeiro,
        "total_pago": sum((p.valor for p in pagamentos), Decimal("0.00")),
        "saldo_restante": saldo_restante,
        "rotulo_saldo": rotulo_saldo,
        "emitido_em": timezone.now(),
    }
    return render(request, "fiado/impressao/recibo.html", contexto)


def recibo(request, pagamento_id):
    pagamento = get_object_or_404(
        Pagamento.objects.select_related("nota__cliente", "recebido_por"), pk=pagamento_id
    )
    return _recibo(request, [pagamento], pagamento.nota.saldo, "Saldo restante da nota")


def recibo_lote(request, lote):
    pagamentos = list(
        Pagamento.objects.filter(lote=lote)
        .select_related("nota__cliente", "recebido_por")
        .order_by("id")
    )
    if not pagamentos:
        raise Http404
    cliente = pagamentos[0].nota.cliente
    return _recibo(
        request, pagamentos, consultas.divida_do_cliente(cliente), "Saldo restante do cliente"
    )
