from django.urls import path

from fiado.api import clientes, leitura, notas, sessao

urlpatterns = [
    path("sessao", sessao.sessao),
    path("entrar", sessao.entrar),
    path("sair", sessao.sair),
    path("painel", leitura.painel),
    path("busca", leitura.busca),
    path("pagas", leitura.pagas),
    path("itens/sugestoes", leitura.sugestoes_de_item),
    path("clientes", clientes.lista),
    path("clientes/<int:codigo>", clientes.detalhe),
    path("clientes/<int:codigo>/divida/previa", clientes.previa_divida),
    path("clientes/<int:codigo>/notas", clientes.criar_nota_do_cliente),
    path("clientes/<int:codigo>/pagamentos", clientes.pagar_divida),
    path("notas/<int:cliente_codigo>-<int:numero>", notas.detalhe),
    path("notas/<int:cliente_codigo>-<int:numero>/itens", notas.itens),
    path("notas/<int:cliente_codigo>-<int:numero>/itens/<int:item_id>", notas.item),
    path("notas/<int:cliente_codigo>-<int:numero>/finalizar", notas.finalizar),
    path("notas/<int:cliente_codigo>-<int:numero>/fechar", notas.fechar),
    path("notas/<int:cliente_codigo>-<int:numero>/pagamentos", notas.pagamentos),
]
