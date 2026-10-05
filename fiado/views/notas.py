from django.shortcuts import render

from fiado.models import Pagamento
from fiado.views.comum import obter_nota


def nota_detalhe(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    contexto = {
        "nota": nota,
        "itens": list(nota.itens.all()),
        "pagamentos": list(nota.pagamentos.all()),
        "total": nota.total,
        "total_pago": nota.total_pago,
        "saldo": nota.saldo,
        "formas": Pagamento.Forma.choices,
    }
    return render(request, "fiado/nota.html", contexto)
