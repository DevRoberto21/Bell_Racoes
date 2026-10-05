import getpass

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

CAIXAS = [("caixa1", "Flávia", "senha1"), ("caixa2", "Marcineide", "senha2")]


class Command(BaseCommand):
    help = "Cria os usuários caixa1 e caixa2, ou troca a senha deles."

    def add_arguments(self, parser):
        parser.add_argument("--senha1")
        parser.add_argument("--senha2")

    def handle(self, *args, **opcoes):
        Usuario = get_user_model()
        for nome_de_usuario, nome, chave in CAIXAS:
            senha = opcoes[chave] or getpass.getpass(f"Senha para {nome_de_usuario} ({nome}): ")
            usuario, _ = Usuario.objects.get_or_create(username=nome_de_usuario)
            usuario.first_name = nome
            usuario.set_password(senha)
            usuario.save()
            self.stdout.write(f"{nome_de_usuario} pronto.")
