from django.shortcuts import get_object_or_404

from fiado.api.http import api
from fiado.api.serializadores import nota_completa
from fiado.models import Nota


def obter_nota(cliente_codigo, numero):
    return get_object_or_404(
        Nota.objects.select_related("cliente"), cliente__codigo=cliente_codigo, numero=numero
    )


@api("GET")
def detalhe(request, cliente_codigo, numero):
    return nota_completa(obter_nota(cliente_codigo, numero))
