from django.db import transaction
from django.utils import timezone

from fiado.erros import ErroDeRegra
from fiado.models import CorrecaoNota, ItemNota
from fiado.servicos.versao import gravar, quitar_se_zerou, travar


def _copia(item):
    return {
        "descricao": item.descricao,
        "quantidade": str(item.quantidade),
        "preco_unitario": str(item.preco_unitario),
        "subtotal": str(item.subtotal),
        "adicionado_em": item.adicionado_em.isoformat(),
    }


@transaction.atomic
def corrigir_nota(*, nota, versao, itens, usuario, agora=None):
    agora = agora or timezone.now()
    nota = travar(nota, versao)
    if not nota.em_divida:
        raise ErroDeRegra("Esta nota não pode ser corrigida.")
    if not itens:
        raise ErroDeRegra("A nota precisa de pelo menos um item.")
    for item in itens:
        if not item["descricao"].strip() or item["quantidade"] <= 0 or item["preco_unitario"] <= 0:
            raise ErroDeRegra("Todo item precisa de descrição, quantidade e preço maiores que zero.")

    correcao = CorrecaoNota.objects.create(
        nota=nota,
        feita_por=usuario,
        feita_em=agora,
        itens_anteriores=[_copia(item) for item in nota.itens.all()],
        total_anterior=nota.total,
    )
    nota.itens.all().delete()
    for item in itens:
        ItemNota.objects.create(
            nota=nota,
            descricao=item["descricao"].strip(),
            quantidade=item["quantidade"],
            preco_unitario=item["preco_unitario"],
            adicionado_em=agora,
            adicionado_por=usuario,
        )
    if nota.total < nota.total_pago:
        raise ErroDeRegra("O novo total fica abaixo do valor já pago nesta nota.")
    gravar(nota, editada=True, editada_em=agora)
    quitar_se_zerou(nota, agora)
    correcao.nota = nota
    return correcao
