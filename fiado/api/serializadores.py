from decimal import Decimal

from django.utils import timezone

from fiado import consultas
from fiado.models import Nota

S = Nota.Situacao
T = Nota.Tipo
ZERO = Decimal("0.00")


def dinheiro(valor):
    return str(Decimal(valor).quantize(Decimal("0.01")))


def _data(valor):
    return timezone.localtime(valor).isoformat() if valor else None


def cliente_linha(cliente, divida, notas_abertas):
    return {
        "codigo": cliente.codigo,
        "codigo_formatado": cliente.codigo_formatado,
        "nome": cliente.nome,
        "apelido": cliente.apelido,
        "telefone": cliente.telefone,
        "divida": dinheiro(divida),
        "notas_abertas": notas_abertas,
    }


def linhas_de_clientes(clientes):
    dividas = consultas.dividas_por_cliente()
    abertas = consultas.notas_abertas_por_cliente()
    return [
        cliente_linha(c, dividas.get(c.id, ZERO), abertas.get(c.id, 0)) for c in clientes
    ]


def _continua_aberta(par):
    if par is None:
        return None
    nota, saldo = par
    return {
        "codigo": nota.codigo,
        "saldo": dinheiro(saldo),
        "dias_em_aberto": nota.dias_em_aberto(),
    }


def linhas_da_busca(clientes):
    """Linhas de clientes para a busca por nome: cada uma leva a nota contínua aberta, se houver."""
    continuas = consultas.continuas_abertas(clientes)
    return [
        linha | {"continua_aberta": _continua_aberta(continuas.get(cliente.id))}
        for cliente, linha in zip(clientes, linhas_de_clientes(clientes))
    ]


def cliente_detalhe(cliente):
    notas = list(consultas.notas_em_aberto(cliente))
    return cliente_linha(cliente, consultas.divida_do_cliente(cliente), len(notas)) | {
        "notas": [nota_resumo(nota) for nota in notas],
        "tem_continua_aberta": any(
            nota.tipo == T.CONTINUA and nota.situacao == S.ABERTA for nota in notas
        ),
        "pode_excluir": not cliente.notas.exists(),
    }


def nota_resumo(nota, hoje=None):
    return _resumo(nota, nota.total, nota.saldo, hoje)


def _resumo(nota, total, saldo, hoje):
    cliente = nota.cliente
    return {
        "codigo": nota.codigo,
        "cliente": {
            "codigo": cliente.codigo,
            "codigo_formatado": cliente.codigo_formatado,
            "nome": cliente.nome,
        },
        "numero": nota.numero,
        "tipo": nota.tipo,
        "tipo_rotulo": nota.get_tipo_display(),
        "situacao": nota.situacao,
        "situacao_rotulo": nota.get_situacao_display(),
        "criada_em": _data(nota.criada_em),
        "quitada_em": _data(nota.quitada_em),
        "editada": nota.editada,
        "dias_em_aberto": nota.dias_em_aberto(hoje),
        "nivel_alerta": nota.nivel_alerta(hoje),
        "total": dinheiro(total),
        "saldo": dinheiro(saldo),
        "imprimir_url": f"/notas/{cliente.codigo}-{nota.numero}/imprimir/",
    }


def acoes_da_nota(nota, tem_itens, tem_pagamentos, saldo):
    rascunho = nota.situacao == S.RASCUNHO
    continua_aberta = nota.tipo == T.CONTINUA and nota.situacao == S.ABERTA
    return {
        "adicionar_item": nota.aceita_itens,
        "remover_item": rascunho,
        "finalizar": nota.tipo == T.UNICA and rascunho and tem_itens,
        "fechar": continua_aberta and tem_itens,
        "descartar": rascunho or (continua_aberta and not tem_itens and not tem_pagamentos),
        "receber": nota.em_divida and saldo > ZERO,
        "corrigir": nota.em_divida,
        "imprimir": not rascunho,
    }


def recibo_url(pagamento):
    if pagamento.lote:
        return f"/recibos/lote/{pagamento.lote}/"
    return f"/recibos/{pagamento.id}/"


def nota_completa(nota, hoje=None):
    itens = list(nota.itens.all())
    pagamentos = list(nota.pagamentos.select_related("recebido_por"))
    total, total_pago, saldo = nota.total, nota.total_pago, nota.saldo
    return _resumo(nota, total, saldo, hoje) | {
        "editada_em": _data(nota.editada_em),
        "versao": nota.versao,
        "total_pago": dinheiro(total_pago),
        "itens": [
            {
                "id": item.id,
                "descricao": item.descricao,
                "quantidade": str(item.quantidade),
                "preco_unitario": dinheiro(item.preco_unitario),
                "subtotal": dinheiro(item.subtotal),
            }
            for item in itens
        ],
        "pagamentos": [
            {
                "id": pagamento.id,
                "valor": dinheiro(pagamento.valor),
                "forma": pagamento.forma,
                "forma_rotulo": pagamento.get_forma_display(),
                "recebido_em": _data(pagamento.recebido_em),
                "recebido_por": pagamento.recebido_por.get_username(),
                "recibo_url": recibo_url(pagamento),
            }
            for pagamento in pagamentos
        ],
        "acoes": acoes_da_nota(nota, bool(itens), bool(pagamentos), saldo),
    }
