import re
from decimal import Decimal


class DadosInvalidos(Exception):
    """Corpo da requisição com campo ausente ou em formato errado."""

    def __init__(self, campos):
        super().__init__("Confira os campos destacados.")
        self.campos = campos


def _falha(campo, mensagem):
    raise DadosInvalidos({campo: mensagem})


def texto(dados, campo, maximo, obrigatorio=True):
    valor = dados.get(campo, "")
    if not isinstance(valor, str):
        _falha(campo, "Valor inválido.")
    valor = valor.strip()
    if obrigatorio and not valor:
        _falha(campo, "Preencha este campo.")
    if len(valor) > maximo:
        _falha(campo, f"Use no máximo {maximo} caracteres.")
    return valor


def decimal(dados, campo, casas):
    """Aceita só texto como "96.40": dígitos, ponto opcional e até `casas` casas."""
    valor = dados.get(campo)
    if not isinstance(valor, str) or not re.fullmatch(rf"\d{{1,9}}(\.\d{{1,{casas}}})?", valor):
        _falha(campo, "Informe um número válido.")
    return Decimal(valor)


def opcao(dados, campo, validas):
    valor = dados.get(campo)
    if valor not in validas:
        _falha(campo, "Opção inválida.")
    return valor


def lista(dados, campo):
    valor = dados.get(campo)
    if not isinstance(valor, list):
        _falha(campo, "Lista inválida.")
    return valor
