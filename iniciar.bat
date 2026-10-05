@echo off
chcp 65001 >nul
cd /d %~dp0

rem Dados da loja que saem na nota e no recibo. Edite as tres linhas abaixo.
set BELL_LOJA_NOME=Bell Rações
set BELL_LOJA_ENDERECO=
set BELL_LOJA_TELEFONE=

uv run --no-dev python manage.py migrate --noinput
if errorlevel 1 goto erro
uv run --no-dev waitress-serve --listen=0.0.0.0:8000 --threads=8 bellracoes.wsgi:application

:erro
echo.
echo O sistema parou. Anote a mensagem acima antes de fechar esta janela.
pause
