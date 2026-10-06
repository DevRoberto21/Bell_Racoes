from django.urls import path, re_path

from fiado.views import impressao, spa

urlpatterns = [
    path("notas/<int:cliente_codigo>-<int:numero>/imprimir/", impressao.imprimir_nota, name="imprimir_nota"),
    path("recibos/<int:pagamento_id>/", impressao.recibo, name="recibo"),
    path("recibos/lote/<uuid:lote>/", impressao.recibo_lote, name="recibo_lote"),
    re_path(r"^(?!api/|static/).*$", spa.spa, name="spa"),
]
