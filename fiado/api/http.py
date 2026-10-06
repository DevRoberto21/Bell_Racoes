import json
from functools import wraps

from django.contrib.auth.decorators import login_not_required
from django.http import Http404, HttpResponse, JsonResponse

from fiado.api.validacao import DadosInvalidos
from fiado.erros import ConflitoDeVersao, ErroDeRegra


def erro(mensagem, status, campos=None):
    return JsonResponse({"erro": mensagem, "campos": campos or {}}, status=status)


def _ler_corpo(request):
    if not request.body:
        return {}
    dados = json.loads(request.body)
    if not isinstance(dados, dict):
        raise ValueError("corpo não é objeto")
    return dados


def api(*metodos, login=True):
    """Envolve uma view JSON: método, login, corpo e erros num lugar só."""

    def decorador(view):
        @login_not_required
        @wraps(view)
        def interna(request, *args, **kwargs):
            if request.method not in metodos:
                return erro("Método não permitido.", 405)
            if login and not request.user.is_authenticated:
                return erro("Entre no sistema para continuar.", 401)
            try:
                request.dados = _ler_corpo(request)
            except ValueError:
                return erro("Dados enviados em formato inválido.", 400)
            try:
                resposta = view(request, *args, **kwargs)
            except DadosInvalidos as falha:
                return erro(str(falha), 400, falha.campos)
            except ConflitoDeVersao as falha:
                return erro(str(falha), 409)
            except ErroDeRegra as falha:
                return erro(str(falha), 400)
            except Http404:
                return erro("Não encontrado.", 404)
            if isinstance(resposta, HttpResponse):
                return resposta
            return JsonResponse(resposta, safe=False)

        return interna

    return decorador
