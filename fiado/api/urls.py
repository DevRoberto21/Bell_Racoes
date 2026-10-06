from django.urls import path

from fiado.api import sessao

urlpatterns = [
    path("sessao", sessao.sessao),
    path("entrar", sessao.entrar),
    path("sair", sessao.sair),
]
