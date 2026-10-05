from decimal import Decimal

from fiado.models import Nota
from fiado.servicos.notas import adicionar_item, criar_nota, finalizar_nota


def _com_item(nota, usuario, valor):
    return adicionar_item(
        nota=nota,
        versao=nota.versao,
        descricao="Ração 15kg",
        quantidade=Decimal("1"),
        preco_unitario=Decimal(valor),
        usuario=usuario,
    )


def _datar(nota, criada_em):
    if criada_em:
        Nota.objects.filter(pk=nota.pk).update(criada_em=criada_em)
        nota.refresh_from_db()
    return nota


def nota_unica_fechada(cliente, usuario, valor="100.00", criada_em=None):
    nota = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    nota = _com_item(nota, usuario, valor)
    nota = finalizar_nota(nota=nota, versao=nota.versao)
    return _datar(nota, criada_em)


def nota_continua_aberta(cliente, usuario, valor="100.00", criada_em=None):
    nota = criar_nota(cliente=cliente, tipo=Nota.Tipo.CONTINUA, usuario=usuario)
    nota = _com_item(nota, usuario, valor)
    return _datar(nota, criada_em)
