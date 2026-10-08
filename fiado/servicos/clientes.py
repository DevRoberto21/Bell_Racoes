import re

from django.db import transaction

from fiado.api.validacao import DadosInvalidos
from fiado.erros import ErroDeRegra
from fiado.models import Cliente, Sequencia

MENSAGEM_TELEFONE = "Telefone incompleto. Use (dd)9xxxx-xxxx."


def normalizar_telefone(texto):
    """Celular brasileiro como (dd)9xxxx-xxxx; vazio continua vazio."""
    texto = texto.strip()
    if not texto:
        return ""
    digitos = re.sub(r"\D", "", texto)
    if len(digitos) > 11 and digitos.startswith("55"):
        digitos = digitos[2:]
    if not re.fullmatch(r"[1-9]\d9\d{8}", digitos):
        raise DadosInvalidos({"telefone": MENSAGEM_TELEFONE})
    return f"({digitos[:2]}){digitos[2:7]}-{digitos[7:]}"


@transaction.atomic
def criar_cliente(*, nome, apelido="", telefone=""):
    sequencia, _ = Sequencia.objects.get_or_create(nome="cliente")
    sequencia.valor += 1
    sequencia.save()
    return Cliente.objects.create(
        codigo=sequencia.valor,
        nome=nome.strip(),
        apelido=apelido.strip(),
        telefone=normalizar_telefone(telefone),
    )


@transaction.atomic
def excluir_cliente(cliente):
    if cliente.notas.exists():
        raise ErroDeRegra("Cliente com nota não pode ser excluído.")
    cliente.delete()


@transaction.atomic
def editar_cliente(cliente, *, nome, apelido="", telefone=""):
    cliente = Cliente.objects.get(pk=cliente.pk)
    cliente.nome = nome.strip()
    cliente.apelido = apelido.strip()
    cliente.telefone = normalizar_telefone(telefone)
    cliente.save(update_fields=["nome", "apelido", "telefone", "texto_busca"])
    return cliente
