@echo off
cd /d %~dp0
uv run python manage.py migrate --noinput
uv run waitress-serve --listen=0.0.0.0:8000 --threads=8 bellracoes.wsgi:application
