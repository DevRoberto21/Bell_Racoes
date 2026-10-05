from django.contrib import messages
from django.shortcuts import redirect, render

from fiado.erros import ConflitoDeVersao, ErroDeRegra
from fiado.forms import ItemFormSet
from fiado.servicos.correcoes import corrigir_nota
from fiado.views.comum import obter_nota

CAMPOS = ("descricao", "quantidade", "preco_unitario")


def _itens_do_formulario(formset):
    return [
        {campo: form.cleaned_data[campo] for campo in CAMPOS}
        for form in formset.forms
        if form.cleaned_data and not form.cleaned_data.get("DELETE")
    ]


def correcao(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    if not nota.em_divida:
        messages.error(request, "Esta nota não pode ser corrigida.")
        return redirect(nota)

    if request.method == "POST":
        formset = ItemFormSet(request.POST)
        versao = request.POST.get("versao")
        if formset.is_valid():
            try:
                corrigir_nota(
                    nota=nota,
                    versao=versao,
                    itens=_itens_do_formulario(formset),
                    usuario=request.user,
                )
            except ConflitoDeVersao as erro:
                messages.error(request, str(erro))
                return redirect(nota)
            except ErroDeRegra as erro:
                messages.error(request, str(erro))
            else:
                return redirect("imprimir_nota", cliente_codigo, numero)
        else:
            messages.error(request, "Confira descrição, quantidade e preço de cada item.")
    else:
        versao = nota.versao
        formset = ItemFormSet(
            initial=[{campo: getattr(item, campo) for campo in CAMPOS} for item in nota.itens.all()]
        )

    contexto = {"nota": nota, "formset": formset, "versao": versao, "total_pago": nota.total_pago}
    return render(request, "fiado/correcao.html", contexto)
