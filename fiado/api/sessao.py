from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie

from fiado.api.http import api, erro
from fiado.api.validacao import senha, texto


def _usuario_json(usuario):
    if not usuario.is_authenticated:
        return None
    return {"nome_de_usuario": usuario.username, "nome": usuario.first_name}


@ensure_csrf_cookie
@api("GET", login=False)
def sessao(request):
    return {"usuario": _usuario_json(request.user)}


@api("POST", login=False)
def entrar(request):
    usuario = authenticate(
        request,
        username=texto(request.dados, "usuario", 150),
        password=senha(request.dados, "senha"),
    )
    if usuario is None:
        return erro("Usuário ou senha incorretos.", 400)
    login(request, usuario)
    return {"usuario": _usuario_json(usuario)}


@api("POST")
def sair(request):
    logout(request)
    return {"usuario": None}
