from decimal import Decimal

from django.contrib import messages
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from fiado import consultas
from fiado.erros import ErroDeRegra
from fiado.forms import DividaTotalForm, PagamentoForm, ValorForm
from fiado.models import Cliente, Pagamento
from fiado.servicos.pagamentos import distribuir, pagar_divida_total, registrar_pagamento
from fiado.views.comum import acao_de_nota


@acao_de_nota
def pagamento_view(request, nota, versao):
    form = PagamentoForm(request.POST)
    if not form.is_valid():
        messages.error(request, "Confira o valor e a forma de pagamento.")
        return None
    pagamento = registrar_pagamento(
        nota=nota, versao=versao, usuario=request.user, **form.cleaned_data
    )
    return redirect("recibo", pagamento.id)


def _previa(cliente, valor):
    partes, sobra = distribuir(cliente, valor)
    return {"partes": partes, "sobra": sobra, "valor": valor}


def pagar_divida(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    divida = consultas.divida_do_cliente(cliente)
    if request.method == "POST":
        form = DividaTotalForm(request.POST)
        if form.is_valid():
            try:
                pagamentos = pagar_divida_total(
                    cliente=cliente,
                    usuario=request.user,
                    valor=form.cleaned_data["valor"],
                    forma=form.cleaned_data["forma"],
                    divida_esperada=form.cleaned_data["divida"],
                )
            except ErroDeRegra as erro:
                messages.error(request, str(erro))
            else:
                return redirect("recibo_lote", pagamentos[0].lote)
        else:
            messages.error(request, "Confira o valor e a forma de pagamento.")
        valor = form.cleaned_data.get("valor", divida)
    else:
        form = DividaTotalForm()
        valor = divida
    contexto = {"cliente": cliente, "divida": divida, "form": form} | _previa(cliente, valor)
    return render(request, "fiado/pagar_divida.html", contexto)


def previa_divida(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    form = ValorForm(request.GET)
    valor = form.cleaned_data["valor"] if form.is_valid() else Decimal("0.00")
    return render(request, "fiado/_previa_divida.html", _previa(cliente, valor))


def _recibo(request, pagamentos, saldo_restante, rotulo_saldo, voltar):
    primeiro = pagamentos[0]
    contexto = {
        "pagamentos": pagamentos,
        "cliente": primeiro.nota.cliente,
        "primeiro": primeiro,
        "total_pago": sum((p.valor for p in pagamentos), Decimal("0.00")),
        "saldo_restante": saldo_restante,
        "rotulo_saldo": rotulo_saldo,
        "voltar": voltar,
        "emitido_em": timezone.now(),
    }
    return render(request, "fiado/impressao/recibo.html", contexto)


def recibo(request, pagamento_id):
    pagamento = get_object_or_404(
        Pagamento.objects.select_related("nota__cliente", "recebido_por"), pk=pagamento_id
    )
    return _recibo(
        request,
        [pagamento],
        pagamento.nota.saldo,
        "Saldo restante da nota",
        pagamento.nota.get_absolute_url(),
    )


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
        request,
        pagamentos,
        consultas.divida_do_cliente(cliente),
        "Saldo restante do cliente",
        reverse("cliente", args=[cliente.codigo]),
    )
