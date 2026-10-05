from django.urls import path

from fiado.views import clientes, notas, painel

NOTA = "notas/<int:cliente_codigo>-<int:numero>/"

urlpatterns = [
    path("", painel.painel, name="painel"),
    path("busca/", clientes.busca, name="busca"),
    path("clientes/", clientes.lista_clientes, name="clientes"),
    path("clientes/novo/", clientes.novo_cliente, name="novo_cliente"),
    path("clientes/<int:codigo>/", clientes.registro_cliente, name="cliente"),
    path("clientes/<int:codigo>/editar/", clientes.editar_cliente, name="editar_cliente"),
    path("clientes/<int:codigo>/excluir/", clientes.excluir_cliente_view, name="excluir_cliente"),
    path("clientes/<int:codigo>/nota/", clientes.abrir_nota_do_cliente, name="abrir_nota_do_cliente"),
    path("clientes/<int:codigo>/notas/nova/", clientes.nova_nota, name="nova_nota"),
    path(NOTA, notas.nota_detalhe, name="nota"),
]
