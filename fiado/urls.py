from django.urls import path

from fiado.views import clientes, correcoes, notas, pagamentos, painel

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
    path(NOTA + "itens/", notas.adicionar_item_view, name="adicionar_item"),
    path(NOTA + "itens/<int:item_id>/remover/", notas.remover_item_view, name="remover_item"),
    path(NOTA + "finalizar/", notas.finalizar_view, name="finalizar_nota"),
    path(NOTA + "fechar/", notas.fechar_view, name="fechar_nota"),
    path(NOTA + "descartar/", notas.descartar_view, name="descartar_nota"),
    path(NOTA + "imprimir/", notas.imprimir_nota, name="imprimir_nota"),
    path(NOTA + "pagamento/", pagamentos.pagamento_view, name="pagamento"),
    path(NOTA + "correcao/", correcoes.correcao, name="correcao"),
    path("clientes/<int:codigo>/pagar/", pagamentos.pagar_divida, name="pagar_divida"),
    path("clientes/<int:codigo>/pagar/previa/", pagamentos.previa_divida, name="previa_divida"),
    path("recibos/<int:pagamento_id>/", pagamentos.recibo, name="recibo"),
    path("recibos/lote/<uuid:lote>/", pagamentos.recibo_lote, name="recibo_lote"),
]
