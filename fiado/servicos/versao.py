from decimal import Decimal

from fiado.erros import ConflitoDeVersao
from fiado.models import Nota

MENSAGEM_CONFLITO = "Esta nota foi alterada no outro caixa. A tela foi atualizada; confira e repita."


def travar(nota, versao):
    """Recarrega a nota dentro da transação e confere se a tela estava atualizada."""
    atual = Nota.objects.select_related("cliente").get(pk=nota.pk)
    try:
        esperada = int(versao)
    except (TypeError, ValueError):
        esperada = -1
    if atual.versao != esperada:
        raise ConflitoDeVersao(MENSAGEM_CONFLITO)
    return atual


def gravar(nota, **campos):
    for nome, valor in campos.items():
        setattr(nota, nome, valor)
    nota.versao += 1
    nota.save()
    return nota


def quitar_se_zerou(nota, agora):
    """Nota fechada com saldo zero vira quitada. Não mexe na versão."""
    if nota.situacao == Nota.Situacao.FECHADA and nota.saldo == Decimal("0.00"):
        nota.situacao = Nota.Situacao.QUITADA
        nota.quitada_em = agora
        nota.save(update_fields=["situacao", "quitada_em"])
    return nota
