from django.conf import settings


def loja(request):
    return {
        "loja": {
            "nome": settings.LOJA_NOME,
            "endereco": settings.LOJA_ENDERECO,
        }
    }
