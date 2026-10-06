import re
from decimal import Decimal

from django.shortcuts import get_object_or_404

from fiado import consultas
from fiado.api.http import api
from fiado.api.serializadores import cliente_detalhe, cliente_linha, dinheiro
from fiado.busca import filtrar_clientes
from fiado.models import Cliente
from fiado.servicos.pagamentos import distribuir

ZERO = Decimal("0.00")
PADRAO_VALOR = re.compile(r"\d{1,9}(\.\d{1,2})?")


@api("GET")
def lista(request):
    dividas = consultas.dividas_por_cliente()
    abertas = consultas.notas_abertas_por_cliente()
    clientes = filtrar_clientes(request.GET.get("q", ""))
    return [
        cliente_linha(c, dividas.get(c.id, ZERO), abertas.get(c.id, 0)) for c in clientes
    ]


@api("GET")
def detalhe(request, codigo):
    return cliente_detalhe(get_object_or_404(Cliente, codigo=codigo))


@api("GET")
def previa_divida(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    divida = consultas.divida_do_cliente(cliente)
    texto = request.GET.get("valor", "")
    partes, sobra = [], ZERO
    if PADRAO_VALOR.fullmatch(texto):
        partes, sobra = distribuir(cliente, Decimal(texto))
    return {
        "divida": dinheiro(divida),
        "sobra": dinheiro(sobra),
        "partes": [
            {"codigo": nota.codigo, "saldo": dinheiro(nota.saldo), "parte": dinheiro(parte)}
            for nota, parte in partes
        ],
    }
