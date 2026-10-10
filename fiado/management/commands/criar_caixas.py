import getpass

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

CAIXAS = [("caixa1", "Flávia", "senha1"), ("caixa2", "Marcineide", "senha2")]
SENHA_EM_BRANCO = "A senha não pode ficar em branco."
AVISO = "Ao digitar a senha, nada aparece na tela. Digite e aperte Enter."


class Command(BaseCommand):
    help = "Cria os usuários caixa1 e caixa2, ou troca a senha deles."

    def add_arguments(self, parser):
        parser.add_argument("--senha1")
        parser.add_argument("--senha2")

    def handle(self, *args, **opcoes):
        Usuario = get_user_model()
        if not all(opcoes[chave] for _, _, chave in CAIXAS):
            self.stdout.write(AVISO)
        # Os dois caixas são gravados juntos ou nenhum: se a janela fechar no meio,
        # a próxima abertura volta a pedir as senhas.
        with transaction.atomic():
            for nome_de_usuario, nome, chave in CAIXAS:
                senha = opcoes[chave] or self._perguntar(nome_de_usuario, nome)
                if not senha.strip():
                    raise CommandError(SENHA_EM_BRANCO)
                usuario, _ = Usuario.objects.get_or_create(username=nome_de_usuario)
                usuario.first_name = nome
                usuario.set_password(senha)
                usuario.save()
                self.stdout.write(f"{nome_de_usuario} pronto.")

    def _perguntar(self, nome_de_usuario, nome):
        while True:
            senha = getpass.getpass(f"Senha para {nome_de_usuario} ({nome}): ")
            if not senha.strip():
                self.stdout.write(SENHA_EM_BRANCO)
                continue
            if getpass.getpass("Digite a mesma senha de novo: ") == senha:
                return senha
            self.stdout.write("As senhas não são iguais. Tente de novo.")
