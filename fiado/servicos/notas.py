from django.db import transaction
from django.utils import timezone

from fiado.erros import ErroDeRegra
from fiado.models import Cliente, ItemNota, Nota, subtotal_de
from fiado.servicos.versao import gravar, quitar_se_zerou, travar

S, T = Nota.Situacao, Nota.Tipo


@transaction.atomic
def criar_nota(*, cliente, tipo, usuario):
    if tipo not in T.values:
        raise ErroDeRegra("Tipo de nota inválido.")
    cliente = Cliente.objects.get(pk=cliente.pk)
    if tipo == T.CONTINUA and cliente.notas.filter(tipo=T.CONTINUA, situacao=S.ABERTA).exists():
        raise ErroDeRegra("Este cliente já tem uma nota contínua aberta.")
    cliente.ultimo_numero_nota += 1
    cliente.save(update_fields=["ultimo_numero_nota"])
    return Nota.objects.create(
        cliente=cliente,
        numero=cliente.ultimo_numero_nota,
        tipo=tipo,
        situacao=S.RASCUNHO if tipo == T.UNICA else S.ABERTA,
        criada_por=usuario,
    )


@transaction.atomic
def adicionar_item(*, nota, versao, descricao, quantidade, preco_unitario, usuario):
    nota = travar(nota, versao)
    if not nota.aceita_itens:
        raise ErroDeRegra("Esta nota não aceita novos itens. Use o botão de correção.")
    descricao = descricao.strip()
    if not descricao:
        raise ErroDeRegra("Informe a descrição do item.")
    if quantidade <= 0 or preco_unitario <= 0:
        raise ErroDeRegra("Quantidade e preço devem ser maiores que zero.")
    if subtotal_de(quantidade, preco_unitario) == 0:
        raise ErroDeRegra("O valor do item não pode ser zero.")
    ItemNota.objects.create(
        nota=nota,
        descricao=descricao,
        quantidade=quantidade,
        preco_unitario=preco_unitario,
        adicionado_por=usuario,
    )
    return gravar(nota)


@transaction.atomic
def remover_item(*, nota, versao, item_id):
    nota = travar(nota, versao)
    if nota.situacao != S.RASCUNHO:
        raise ErroDeRegra("Para remover um item desta nota, use o botão de correção.")
    nota.itens.filter(pk=item_id).delete()
    return gravar(nota)


@transaction.atomic
def finalizar_nota(*, nota, versao, agora=None):
    nota = travar(nota, versao)
    if nota.tipo != T.UNICA or nota.situacao != S.RASCUNHO:
        raise ErroDeRegra("Só uma nota única em rascunho pode ser finalizada.")
    if not nota.itens.exists():
        raise ErroDeRegra("A nota precisa de pelo menos um item.")
    return gravar(nota, situacao=S.FECHADA, fechada_em=agora or timezone.now())


@transaction.atomic
def fechar_nota(*, nota, versao, agora=None):
    agora = agora or timezone.now()
    nota = travar(nota, versao)
    if nota.tipo != T.CONTINUA or nota.situacao != S.ABERTA:
        raise ErroDeRegra("Só uma nota contínua aberta pode ser fechada.")
    if not nota.itens.exists():
        raise ErroDeRegra("A nota precisa de pelo menos um item. Nota vazia pode ser descartada.")
    nota = gravar(nota, situacao=S.FECHADA, fechada_em=agora)
    return quitar_se_zerou(nota, agora)


@transaction.atomic
def descartar_nota(*, nota, versao):
    nota = travar(nota, versao)
    rascunho = nota.situacao == S.RASCUNHO
    continua_vazia = (
        nota.tipo == T.CONTINUA
        and nota.situacao == S.ABERTA
        and not nota.itens.exists()
        and not nota.pagamentos.exists()
    )
    if not (rascunho or continua_vazia):
        raise ErroDeRegra("Só rascunho ou nota contínua vazia pode ser descartada.")
    nota.delete()
