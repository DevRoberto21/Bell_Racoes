from django.conf import settings
from django.contrib.auth.decorators import login_not_required
from django.http import HttpResponse

SEM_FRONT = (
    "<h1>O front ainda não foi gerado</h1>"
    "<p>Na máquina de desenvolvimento, rode <code>npm --prefix frontend run build</code> "
    "e copie a pasta do projeto de novo.</p>"
)


@login_not_required
def spa(request):
    indice = settings.FRONT_DIST / "index.html"
    if not indice.is_file():
        return HttpResponse(SEM_FRONT, status=503)
    resposta = HttpResponse(indice.read_text(encoding="utf-8"))
    resposta["Cache-Control"] = "no-cache"
    return resposta
