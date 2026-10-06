import os
from pathlib import Path

from django.core.management.utils import get_random_secret_key

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("BELL_DATA_DIR", BASE_DIR / "dados"))
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _chave_secreta():
    arquivo = DATA_DIR / "secret_key.txt"
    if not arquivo.exists():
        arquivo.write_text(get_random_secret_key())
    return arquivo.read_text().strip()


SECRET_KEY = _chave_secreta()
DEBUG = os.environ.get("BELL_DEBUG", "0") == "1"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "fiado",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.auth.middleware.LoginRequiredMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "fiado.middleware.BackupDiarioMiddleware",
]

ROOT_URLCONF = "bellracoes.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "fiado.contexto.loja",
            ],
        },
    },
]

WSGI_APPLICATION = "bellracoes.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DATA_DIR / "bellracoes.sqlite3",
        "OPTIONS": {
            "timeout": 20,
            "transaction_mode": "IMMEDIATE",
            "init_command": "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
        },
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True
USE_THOUSAND_SEPARATOR = False

STATIC_URL = "static/"
WHITENOISE_USE_FINDERS = True
FRONT_DIST = BASE_DIR / "frontend" / "dist"
STATICFILES_DIRS = [("app", FRONT_DIST)] if FRONT_DIST.exists() else []

LOGIN_URL = "/entrar"

SESSION_COOKIE_AGE = 60 * 60 * 24 * 30

LOJA_NOME = os.environ.get("BELL_LOJA_NOME", "Bell Rações")
LOJA_ENDERECO = os.environ.get("BELL_LOJA_ENDERECO", "")
LOJA_TELEFONE = os.environ.get("BELL_LOJA_TELEFONE", "")

BACKUP_ATIVO = os.environ.get("BELL_BACKUP", "1") == "1"
BACKUP_DIR = Path(os.environ.get("BELL_BACKUP_DIR", DATA_DIR / "backups"))
BACKUP_MANTER = 30
