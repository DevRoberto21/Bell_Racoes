from django.conf import settings

from fiado import consultas
from fiado.api.http import api
from fiado.api.serializadores import (
    cliente_detalhe,
    dinheiro,
    linhas_de_clientes,
    nota_resumo,
)
from fiado.backup import copia_de_hoje_existe
from fiado.busca import buscar, filtrar_clientes

LIMITE_BUSCA = 8


@api("GET")
def painel(request):
    return {
        "total_em_aberto": dinheiro(consultas.total_em_aberto()),
        "alertas": [nota_resumo(n) for n in consultas.notas_em_alerta()],
        "rascunhos": [nota_resumo(n) for n in consultas.rascunhos()],
        "backup_falhou": bool(settings.BACKUP_ATIVO and not copia_de_hoje_existe()),
    }


@api("GET")
def busca(request):
    resultado = buscar(request.GET.get("q", ""))
    if resultado.tipo == "nota":
        return {"tipo": "nota", "nota": nota_resumo(resultado.objeto)}
    if resultado.tipo == "cliente":
        return {"tipo": "cliente", "cliente": cliente_detalhe(resultado.objeto)}
    if resultado.tipo == "nao_encontrado":
        return {"tipo": "nao_encontrado", "mensagem": resultado.mensagem}
    if not resultado.termo:
        return {"tipo": "lista", "clientes": []}
    clientes = filtrar_clientes(resultado.termo)[:LIMITE_BUSCA]
    return {"tipo": "lista", "clientes": linhas_de_clientes(clientes)}


@api("GET")
def pagas(request):
    return [nota_resumo(n) for n in consultas.notas_pagas_recentes()]
