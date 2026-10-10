"""Ponto de entrada do sistema. Sem argumentos, abre a loja; com argumentos, roda um comando."""
import os
import socket
import subprocess
import sys
import threading
import traceback
import webbrowser
from pathlib import Path

from bellracoes.caminhos import empacotado

PORTA = 8000
ENDERECO = f"http://localhost:{PORTA}"
THREADS = 8
PASTAS_DO_CHROME = ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA")


def porta_ocupada(porta=PORTA):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as conexao:
        conexao.settimeout(1)
        return conexao.connect_ex(("127.0.0.1", porta)) == 0


def caminho_do_chrome(ambiente=None):
    ambiente = os.environ if ambiente is None else ambiente
    for variavel in PASTAS_DO_CHROME:
        base = ambiente.get(variavel)
        if not base:
            continue
        chrome = Path(base) / "Google" / "Chrome" / "Application" / "chrome.exe"
        if chrome.is_file():
            return chrome
    return None


def abrir_navegador():
    if os.environ.get("BELL_ABRIR_NAVEGADOR", "1") != "1":
        return
    chrome = caminho_do_chrome()
    if chrome:
        # --kiosk-printing imprime sem a janela de confirmação. Só vale se o Chrome estava fechado.
        subprocess.Popen([str(chrome), "--kiosk-printing", ENDERECO])
    else:
        webbrowser.open(ENDERECO)


def preparar():
    import django
    from django.core import management

    django.setup()
    management.call_command("migrate", interactive=False)

    from django.contrib.auth import get_user_model

    if not get_user_model().objects.exists():
        print("Primeira vez neste computador: defina a senha de cada caixa.")
        management.call_command("criar_caixas")


def servir():
    from waitress import serve

    from bellracoes.wsgi import application

    threading.Timer(1.5, abrir_navegador).start()
    print(f"Sistema aberto em {ENDERECO}.")
    print("Deixe esta janela aberta enquanto a loja estiver funcionando.")
    serve(application, listen=f"0.0.0.0:{PORTA}", threads=THREADS)


def principal(argumentos):
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "bellracoes.settings")
    if argumentos:
        from django.core import management

        management.execute_from_command_line(["BellRacoes", *argumentos])
        return 0
    if porta_ocupada():
        print("O sistema já está aberto.")
        abrir_navegador()
        return 0
    preparar()
    servir()
    return 0


def _esperar_enter():
    # Só no executável: sem isto a janela fecha antes de alguém ler a mensagem.
    if not empacotado() or sys.stdin is None or not sys.stdin.isatty():
        return
    try:
        input("\nAperte Enter para fechar esta janela.")
    except EOFError:
        pass


def executar(argumentos):
    try:
        codigo = principal(argumentos)
    except SystemExit as saida:
        codigo = saida.code if isinstance(saida.code, int) else int(bool(saida.code))
    except KeyboardInterrupt:
        codigo = 0
    except Exception:
        traceback.print_exc()
        print("\nO sistema parou. Anote a mensagem acima antes de fechar esta janela.")
        codigo = 1
    if codigo or argumentos:
        _esperar_enter()
    return codigo


if __name__ == "__main__":
    sys.exit(executar(sys.argv[1:]))
