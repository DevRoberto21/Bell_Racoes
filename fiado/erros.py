class ErroDeRegra(Exception):
    """Operação recusada por uma regra de negócio. A mensagem é mostrada ao operador."""


class ConflitoDeVersao(ErroDeRegra):
    """A nota foi alterada no outro caixa depois que esta tela foi aberta."""
