from django.shortcuts import get_object_or_404

from fiado.api.http import api
from fiado.api.serializadores import recibo_url, nota_completa
from fiado.api.validacao import DadosInvalidos, decimal, lista, opcao, texto
from fiado.models import Nota, Pagamento
from fiado.servicos.correcoes import corrigir_nota
from fiado.servicos.notas import (
    adicionar_item,
    descartar_nota,
    fechar_nota,
    finalizar_nota,
    remover_item,
)
from fiado.servicos.pagamentos import registrar_pagamento

CAMPOS_DO_ITEM = ("descricao", "quantidade", "preco_unitario")


def obter_nota(cliente_codigo, numero):
    return get_object_or_404(
        Nota.objects.select_related("cliente"), cliente__codigo=cliente_codigo, numero=numero
    )


def _versao(request):
    return request.dados.get("versao")


def _dados_do_item(dados):
    return {
        "descricao": texto(dados, "descricao", 120),
        "quantidade": decimal(dados, "quantidade", 3),
        "preco_unitario": decimal(dados, "preco_unitario", 2),
    }


def _em_branco(item):
    valores = [item.get(campo) for campo in CAMPOS_DO_ITEM]
    return all(valor is None or (isinstance(valor, str) and not valor.strip()) for valor in valores)


def _itens_da_correcao(dados):
    itens, erros = [], {}
    for indice, bruto in enumerate(lista(dados, "itens")):
        if not isinstance(bruto, dict):
            erros[f"itens.{indice}"] = "Valor inválido."
            continue
        if _em_branco(bruto):
            continue
        try:
            itens.append(_dados_do_item(bruto))
        except DadosInvalidos as falha:
            erros.update({f"itens.{indice}.{campo}": msg for campo, msg in falha.campos.items()})
    if erros:
        raise DadosInvalidos(erros)
    return itens


@api("GET", "DELETE")
def detalhe(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    if request.method == "DELETE":
        descartar_nota(nota=nota, versao=_versao(request))
        return {}
    return nota_completa(nota)


@api("POST", "PUT")
def itens(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    if request.method == "PUT":
        novos = _itens_da_correcao(request.dados)
        correcao = corrigir_nota(
            nota=nota, versao=_versao(request), itens=novos, usuario=request.user
        )
        return nota_completa(correcao.nota)
    nota = adicionar_item(
        nota=nota, versao=_versao(request), usuario=request.user, **_dados_do_item(request.dados)
    )
    return nota_completa(nota)


@api("DELETE")
def item(request, cliente_codigo, numero, item_id):
    nota = obter_nota(cliente_codigo, numero)
    return nota_completa(remover_item(nota=nota, versao=_versao(request), item_id=item_id))


@api("POST")
def finalizar(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    return nota_completa(finalizar_nota(nota=nota, versao=_versao(request)))


@api("POST")
def fechar(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    return nota_completa(fechar_nota(nota=nota, versao=_versao(request)))


@api("POST")
def pagamentos(request, cliente_codigo, numero):
    nota = obter_nota(cliente_codigo, numero)
    valor = decimal(request.dados, "valor", 2)
    forma = opcao(request.dados, "forma", Pagamento.Forma.values)
    pagamento = registrar_pagamento(
        nota=nota, versao=_versao(request), valor=valor, forma=forma, usuario=request.user
    )
    return {"recibo_url": recibo_url(pagamento), "nota": nota_completa(pagamento.nota)}
