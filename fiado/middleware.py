import logging

from django.utils import timezone

from fiado.backup import backup_do_dia

logger = logging.getLogger(__name__)


class BackupDiarioMiddleware:
    """Faz a cópia de segurança no primeiro acesso de cada dia."""

    ultimo_dia = None

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        hoje = timezone.localdate()
        if BackupDiarioMiddleware.ultimo_dia != hoje:
            try:
                backup_do_dia()
                BackupDiarioMiddleware.ultimo_dia = hoje
            except Exception:
                logger.exception("Falha na cópia de segurança")
        return self.get_response(request)
