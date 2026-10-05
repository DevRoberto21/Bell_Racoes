from django.db import transaction

from fiado.erros import ErroDeRegra
from fiado.models import Cliente, Sequencia


@transaction.atomic
def criar_cliente(*, nome, apelido="", telefone=""):
    sequencia, _ = Sequencia.objects.get_or_create(nome="cliente")
    sequencia.valor += 1
    sequencia.save()
    return Cliente.objects.create(
        codigo=sequencia.valor,
        nome=nome.strip(),
        apelido=apelido.strip(),
        telefone=telefone.strip(),
    )


@transaction.atomic
def excluir_cliente(cliente):
    if cliente.notas.exists():
        raise ErroDeRegra("Cliente com nota não pode ser excluído.")
    cliente.delete()
