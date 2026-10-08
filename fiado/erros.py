class ErroDeRegra(Exception):
    """Operação recusada por uma regra de negócio. A mensagem é mostrada ao operador."""


class ConflitoDeVersao(ErroDeRegra):
    """A nota foi alterada no outro caixa depois que esta tela foi aberta."""


class DadosInvalidos(Exception):
    """Corpo da requisição com campo ausente ou em formato errado."""

    def __init__(self, campos):
        super().__init__("Confira os campos destacados.")
        self.campos = campos
