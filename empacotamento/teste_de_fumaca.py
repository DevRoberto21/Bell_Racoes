"""Sobe o programa empacotado com um banco temporário e confere que ele responde.

Uso: python empacotamento/teste_de_fumaca.py dist/BellRacoes/BellRacoes[.exe]
A porta 8000 precisa estar livre.
"""
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ENDERECO = "http://127.0.0.1:8000"
ESPERA_MAXIMA = 60


def rodar(executavel, ambiente, *argumentos):
    resultado = subprocess.run(
        [str(executavel), *argumentos],
        env=ambiente,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    if resultado.returncode != 0:
        print(resultado.stdout)
        print(resultado.stderr, file=sys.stderr)
        raise SystemExit(f"Falhou: {' '.join(argumentos)}")
    return resultado.stdout


def buscar(caminho):
    with urllib.request.urlopen(ENDERECO + caminho, timeout=5) as resposta:
        assert resposta.status == 200, f"{caminho} respondeu {resposta.status}"
        return resposta.read().decode("utf-8", errors="replace")


def esperar_servidor(servidor):
    limite = time.monotonic() + ESPERA_MAXIMA
    while time.monotonic() < limite:
        if servidor.poll() is not None:
            raise SystemExit(f"O servidor fechou sozinho com código {servidor.returncode}.")
        try:
            return buscar("/entrar")
        except OSError:
            time.sleep(1)
    raise SystemExit("O servidor não respondeu a tempo.")


def main():
    executavel = Path(sys.argv[1]).resolve()
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as dados:
        ambiente = {
            **os.environ,
            "BELL_DATA_DIR": dados,
            "BELL_ABRIR_NAVEGADOR": "0",
            "PYTHONIOENCODING": "utf-8",
        }
        rodar(executavel, ambiente, "migrate", "--noinput")
        saida = rodar(executavel, ambiente, "criar_caixas", "--senha1", "fumaca-1", "--senha2", "fumaca-2")
        assert "caixa2 pronto." in saida, saida
        # Exercita o fuso horário (no Windows depende do pacote tzdata embutido) e os templates.
        saida = rodar(
            executavel,
            ambiente,
            "shell",
            "-c",
            "from django.utils import timezone;"
            "from django.template.loader import get_template;"
            "get_template('fiado/impressao/nota.html');"
            "print('fuso', timezone.localtime().tzinfo)",
        )
        assert "fuso America/Sao_Paulo" in saida, saida

        servidor = subprocess.Popen([str(executavel)], env=ambiente, stdin=subprocess.DEVNULL)
        try:
            indice = esperar_servidor(servidor)
            assert 'id="root"' in indice, "o índice das telas não veio"
            script = re.search(r'/static/app/assets/[^"]+\.js', indice)
            assert script, "o índice não aponta para o script das telas"
            buscar(script.group(0))
            buscar("/static/app/favicon.svg")
        finally:
            servidor.terminate()
            servidor.wait(timeout=15)
    print("Teste de fumaça passou.")


if __name__ == "__main__":
    main()
