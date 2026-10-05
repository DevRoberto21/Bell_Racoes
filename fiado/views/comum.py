from functools import wraps

from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST

from fiado.erros import ErroDeRegra
from fiado.models import Nota


def obter_nota(cliente_codigo, numero):
    return get_object_or_404(
        Nota.objects.select_related("cliente"), cliente__codigo=cliente_codigo, numero=numero
    )


def acao_de_nota(view):
    """Envolve uma ação POST sobre uma nota.

    A view recebe (request, nota, versao, **kwargs). ErroDeRegra, que inclui
    ConflitoDeVersao, vira mensagem. Sem resposta própria, volta para a nota.
    """

    @require_POST
    @wraps(view)
    def interna(request, cliente_codigo, numero, **kwargs):
        nota = obter_nota(cliente_codigo, numero)
        try:
            resposta = view(request, nota, request.POST.get("versao"), **kwargs)
        except ErroDeRegra as erro:
            messages.error(request, str(erro))
            resposta = None
        return resposta or redirect("nota", cliente_codigo, numero)

    return interna
