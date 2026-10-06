from django.shortcuts import get_object_or_404

from fiado import consultas
from fiado.api.http import api
from fiado.api.serializadores import (
    ZERO,
    cliente_detalhe,
    dinheiro,
    linhas_de_clientes,
    nota_completa,
)
from fiado.api.validacao import DadosInvalidos, decimal, opcao, texto
from fiado.busca import filtrar_clientes
from fiado.models import Cliente, Nota, Pagamento
from fiado.servicos.clientes import criar_cliente, editar_cliente, excluir_cliente
from fiado.servicos.notas import criar_nota
from fiado.servicos.pagamentos import distribuir, pagar_divida_total


def _campos_do_cliente(dados):
    return {
        "nome": texto(dados, "nome", 120),
        "apelido": texto(dados, "apelido", 60, obrigatorio=False),
        "telefone": texto(dados, "telefone", 20, obrigatorio=False),
    }


@api("GET", "POST")
def lista(request):
    if request.method == "POST":
        return cliente_detalhe(criar_cliente(**_campos_do_cliente(request.dados)))
    return linhas_de_clientes(filtrar_clientes(request.GET.get("q", "")))


@api("GET", "PATCH", "DELETE")
def detalhe(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    if request.method == "PATCH":
        cliente = editar_cliente(cliente, **_campos_do_cliente(request.dados))
        return cliente_detalhe(cliente)
    if request.method == "DELETE":
        excluir_cliente(cliente)
        return {}
    return cliente_detalhe(cliente)


@api("GET")
def previa_divida(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    divida = consultas.divida_do_cliente(cliente)
    partes, sobra = [], ZERO
    try:
        valor = decimal({"valor": request.GET.get("valor", "")}, "valor", 2)
    except DadosInvalidos:
        pass
    else:
        partes, sobra = distribuir(cliente, valor)
    return {
        "divida": dinheiro(divida),
        "sobra": dinheiro(sobra),
        "partes": [
            {"codigo": nota.codigo, "saldo": dinheiro(nota.saldo), "parte": dinheiro(parte)}
            for nota, parte in partes
        ],
    }


@api("POST")
def criar_nota_do_cliente(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    tipo = opcao(request.dados, "tipo", Nota.Tipo.values)
    return nota_completa(criar_nota(cliente=cliente, tipo=tipo, usuario=request.user))


@api("POST")
def pagar_divida(request, codigo):
    cliente = get_object_or_404(Cliente, codigo=codigo)
    valor = decimal(request.dados, "valor", 2)
    forma = opcao(request.dados, "forma", Pagamento.Forma.values)
    esperada = decimal(request.dados, "divida_esperada", 2)
    pagamentos = pagar_divida_total(
        cliente=cliente, valor=valor, forma=forma, usuario=request.user, divida_esperada=esperada
    )
    return {
        "recibo_url": f"/recibos/lote/{pagamentos[0].lote}/",
        "cliente": cliente_detalhe(Cliente.objects.get(pk=cliente.pk)),
    }
