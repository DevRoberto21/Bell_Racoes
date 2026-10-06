from django.urls import path

from fiado.api import clientes, leitura, notas, sessao

urlpatterns = [
    path("sessao", sessao.sessao),
    path("entrar", sessao.entrar),
    path("sair", sessao.sair),
    path("painel", leitura.painel),
    path("busca", leitura.busca),
    path("pagas", leitura.pagas),
    path("clientes", clientes.lista),
    path("clientes/<int:codigo>", clientes.detalhe),
    path("clientes/<int:codigo>/divida/previa", clientes.previa_divida),
    path("notas/<int:cliente_codigo>-<int:numero>", notas.detalhe),
]
