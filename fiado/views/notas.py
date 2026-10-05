from django.contrib import messages
from django.shortcuts import redirect, render

from fiado.forms import ItemForm
from fiado.models import Nota, Pagamento
from fiado.servicos.notas import (
    adicionar_item,
    descartar_nota,
    fechar_nota,
    finalizar_nota,
    remover_item,
)
from fiado.views.comum import acao_de_nota, obter_nota

VIAS = ["VIA DO CLIENTE", "VIA DA LOJA"]


def _contexto(nota):
    return {
        "nota": nota,
        "itens": list(nota.itens.all()),
        "pagamentos": list(nota.pagamentos.all()),
        "total": nota.total,
        "total_pago": nota.total_pago,
        "saldo": nota.saldo,
        "formas": Pagamento.Forma.choices,
    }


def nota_detalhe(request, cliente_codigo, numero):
    return render(request, "fiado/nota.html", _contexto(obter_nota(cliente_codigo, numero)))


@acao_de_nota
def adicionar_item_view(request, nota, versao):
    form = ItemForm(request.POST)
    if not form.is_valid():
        messages.error(request, "Confira descrição, quantidade e preço do item.")
        return None
    adicionar_item(nota=nota, versao=versao, usuario=request.user, **form.cleaned_data)


@acao_de_nota
def remover_item_view(request, nota, versao, item_id):
    remover_item(nota=nota, versao=versao, item_id=item_id)


@acao_de_nota
def finalizar_view(request, nota, versao):
    finalizar_nota(nota=nota, versao=versao)
    return redirect("imprimir_nota", nota.cliente.codigo, nota.numero)


@acao_de_nota
def fechar_view(request, nota, versao):
    fechar_nota(nota=nota, versao=versao)


@acao_de_nota
def descartar_view(request, nota, versao):
    descartar_nota(nota=nota, versao=versao)
    return redirect("cliente", nota.cliente.codigo)


def imprimir_nota(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    if nota.situacao == Nota.Situacao.RASCUNHO:
        messages.error(request, "Finalize a nota antes de imprimir.")
        return redirect(nota)
    contexto = _contexto(nota) | {"vias": VIAS, "voltar": nota.get_absolute_url()}
    return render(request, "fiado/impressao/nota.html", contexto)
