from django.shortcuts import render
from django.utils import timezone

from fiado import consultas


def painel(request):
    hoje = timezone.localdate()
    linhas = [
        {
            "nota": nota,
            "dias": nota.dias_em_aberto(hoje),
            "marca": nota.nivel_alerta(hoje) * consultas.PRAZO_DIAS,
            "saldo": nota.saldo,
        }
        for nota in consultas.notas_em_alerta(hoje)
    ]
    contexto = {"linhas": linhas, "total_em_aberto": consultas.total_em_aberto()}
    return render(request, "fiado/painel.html", contexto)


def pagas(request):
    return render(request, "fiado/pagas.html", {"notas": consultas.notas_pagas_recentes()})
