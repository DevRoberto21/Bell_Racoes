from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from fiado.models import Nota
from fiado.servicos.clientes import criar_cliente
from fiado.servicos.notas import adicionar_item, criar_nota, fechar_nota
from fiado.servicos.pagamentos import pagar_divida_total, registrar_pagamento
from fiado.tests.fabrica import nota_continua_aberta, nota_unica_fechada

pytestmark = pytest.mark.django_db


def _ha(dias):
    return timezone.now() - timedelta(days=dias)


def _pagar(nota, usuario, valor, agora=None):
    return registrar_pagamento(
        nota=nota, versao=nota.versao, valor=Decimal(valor), forma="PIX", usuario=usuario, agora=agora
    )


def test_nota_completa(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00", criada_em=_ha(14))
    pagamento = _pagar(nota, usuario, "40.00")
    corpo = logado.get("/api/notas/1-1").json()
    assert corpo["codigo"] == "01-01"
    assert corpo["cliente"] == {"codigo": 1, "codigo_formatado": "01", "nome": "Maria da Silva"}
    assert (corpo["tipo"], corpo["tipo_rotulo"]) == ("UNICA", "Única")
    assert (corpo["situacao"], corpo["situacao_rotulo"]) == ("FECHADA", "Fechada")
    assert (corpo["dias_em_aberto"], corpo["nivel_alerta"]) == (14, 2)
    assert (corpo["total"], corpo["total_pago"], corpo["saldo"]) == ("100.00", "40.00", "60.00")
    assert corpo["versao"] == pagamento.nota.versao
    assert corpo["itens"] == [
        {
            "id": nota.itens.get().id,
            "descricao": "Ração 15kg",
            "quantidade": "1.000",
            "preco_unitario": "100.00",
            "subtotal": "100.00",
        }
    ]
    assert corpo["pagamentos"][0]["valor"] == "40.00"
    assert corpo["pagamentos"][0]["forma_rotulo"] == "Pix"
    assert corpo["pagamentos"][0]["recebido_por"] == "caixa1"
    assert corpo["pagamentos"][0]["recibo_url"] == f"/recibos/{pagamento.id}/"
    assert corpo["imprimir_url"] == "/notas/1-1/imprimir/"
    assert corpo["acoes"] == {
        "adicionar_item": False,
        "remover_item": False,
        "finalizar": False,
        "fechar": False,
        "descartar": False,
        "receber": True,
        "corrigir": True,
        "imprimir": True,
    }


def test_recibo_de_lote_na_nota(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "50.00")
    pagamentos = pagar_divida_total(
        cliente=cliente, valor=Decimal("20.00"), forma="PIX", usuario=usuario,
        divida_esperada=Decimal("50.00"),
    )
    url = logado.get("/api/notas/1-1").json()["pagamentos"][0]["recibo_url"]
    assert url == f"/recibos/lote/{pagamentos[0].lote}/"


@pytest.mark.parametrize(
    "preparar, esperado",
    [
        ("rascunho_vazio", {"adicionar_item": True, "remover_item": True, "finalizar": False, "descartar": True, "imprimir": False, "receber": False, "corrigir": False, "fechar": False}),
        ("continua_com_item", {"adicionar_item": True, "remover_item": False, "finalizar": False, "descartar": False, "imprimir": True, "receber": True, "corrigir": True, "fechar": True}),
        ("continua_vazia", {"adicionar_item": True, "remover_item": False, "finalizar": False, "descartar": True, "imprimir": True, "receber": False, "corrigir": True, "fechar": False}),
        ("unica_com_item", {"adicionar_item": True, "remover_item": True, "finalizar": True, "descartar": True, "imprimir": False, "receber": False, "corrigir": False, "fechar": False}),
        ("quitada", {"adicionar_item": False, "remover_item": False, "finalizar": False, "descartar": False, "imprimir": True, "receber": False, "corrigir": False, "fechar": False}),
    ],
)
def test_acoes_por_situacao(logado, cliente, usuario, preparar, esperado):
    if preparar == "rascunho_vazio":
        criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    elif preparar == "continua_com_item":
        nota_continua_aberta(cliente, usuario)
    elif preparar == "unica_com_item":
        nota = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
        adicionar_item(
            nota=nota, versao=nota.versao, descricao="Ração 15kg", quantidade=Decimal("1"),
            preco_unitario=Decimal("10.00"), usuario=usuario,
        )
    elif preparar == "continua_vazia":
        criar_nota(cliente=cliente, tipo=Nota.Tipo.CONTINUA, usuario=usuario)
    else:
        _pagar(nota_unica_fechada(cliente, usuario, "10.00"), usuario, "10.00")
    assert logado.get("/api/notas/1-1").json()["acoes"] == esperado


def test_nota_inexistente(logado, cliente):
    resposta = logado.get("/api/notas/1-9")
    assert resposta.status_code == 404
    assert resposta.json() == {"erro": "Não encontrado.", "campos": {}}


def test_lista_de_clientes(logado, cliente, usuario):
    criar_cliente(nome="Ana")
    nota_unica_fechada(cliente, usuario, "100.00")
    corpo = logado.get("/api/clientes").json()
    assert [c["nome"] for c in corpo] == ["Ana", "Maria da Silva"]
    assert corpo[1] == {
        "codigo": 1, "codigo_formatado": "01", "nome": "Maria da Silva", "apelido": "Mariinha",
        "telefone": "85999990000", "divida": "100.00", "notas_abertas": 1,
    }
    assert corpo[0]["divida"] == "0.00"
    assert [c["nome"] for c in logado.get("/api/clientes", {"q": "mariinha"}).json()] == ["Maria da Silva"]


def test_cliente_detalhe(logado, cliente, usuario):
    nova = nota_unica_fechada(cliente, usuario, "30.00", criada_em=_ha(1))
    antiga = nota_continua_aberta(cliente, usuario, "70.00", criada_em=_ha(9))
    corpo = logado.get("/api/clientes/1").json()
    assert corpo["divida"] == "100.00"
    assert [n["codigo"] for n in corpo["notas"]] == [antiga.codigo, nova.codigo]
    assert corpo["notas"][0]["saldo"] == "70.00"
    assert corpo["tem_continua_aberta"] is True
    assert corpo["pode_excluir"] is False
    assert logado.get("/api/clientes/99").status_code == 404


def test_cliente_sem_nota_pode_ser_excluido(logado, cliente):
    assert logado.get("/api/clientes/1").json()["pode_excluir"] is True


def test_previa_da_divida(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "50.00", criada_em=_ha(10))
    nota_unica_fechada(cliente, usuario, "80.00", criada_em=_ha(2))
    corpo = logado.get("/api/clientes/1/divida/previa", {"valor": "70.00"}).json()
    assert corpo == {
        "divida": "130.00",
        "sobra": "0.00",
        "partes": [
            {"codigo": "01-01", "saldo": "50.00", "parte": "50.00"},
            {"codigo": "01-02", "saldo": "80.00", "parte": "20.00"},
        ],
    }
    assert logado.get("/api/clientes/1/divida/previa", {"valor": "200.00"}).json()["sobra"] == "70.00"
    assert logado.get("/api/clientes/1/divida/previa", {"valor": "abc"}).json()["partes"] == []
    assert logado.get("/api/clientes/1/divida/previa").json()["partes"] == []


def test_painel(logado, cliente, usuario, settings):
    settings.BACKUP_ATIVO = False
    atrasada = nota_unica_fechada(cliente, usuario, "100.00", criada_em=_ha(22))
    nota_unica_fechada(cliente, usuario, "30.00", criada_em=_ha(3))
    rascunho = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    corpo = logado.get("/api/painel").json()
    assert corpo["total_em_aberto"] == "130.00"
    assert [n["codigo"] for n in corpo["alertas"]] == [atrasada.codigo]
    assert corpo["alertas"][0]["nivel_alerta"] == 3
    assert [n["codigo"] for n in corpo["rascunhos"]] == [rascunho.codigo]
    assert corpo["backup_falhou"] is False


def test_painel_avisa_backup_ausente(logado, settings, tmp_path, monkeypatch):
    from fiado import middleware

    settings.BACKUP_ATIVO = True
    settings.BACKUP_DIR = tmp_path
    monkeypatch.setattr(middleware, "backup_do_dia", lambda: None)
    monkeypatch.setattr(middleware.BackupDiarioMiddleware, "ultimo_dia", None)
    assert logado.get("/api/painel").json()["backup_falhou"] is True


def test_busca(logado, cliente, usuario):
    nota = nota_unica_fechada(cliente, usuario, "100.00")
    por_nota = logado.get("/api/busca", {"q": "01-01"}).json()
    assert (por_nota["tipo"], por_nota["nota"]["codigo"]) == ("nota", nota.codigo)
    por_cliente = logado.get("/api/busca", {"q": "1"}).json()
    assert por_cliente["tipo"] == "cliente"
    assert por_cliente["cliente"]["notas"][0]["codigo"] == "01-01"
    por_nome = logado.get("/api/busca", {"q": "maria"}).json()
    assert (por_nome["tipo"], por_nome["clientes"][0]["nome"]) == ("lista", "Maria da Silva")
    inexistente = logado.get("/api/busca", {"q": "01-07"}).json()
    assert inexistente == {"tipo": "nao_encontrado", "mensagem": "Nota 01-07 não existe."}


def test_busca_por_texto_limita_a_8(logado):
    for indice in range(10):
        criar_cliente(nome=f"Cliente {indice}")
    assert len(logado.get("/api/busca", {"q": "cliente"}).json()["clientes"]) == 8
    assert logado.get("/api/busca", {"q": ""}).json() == {"tipo": "lista", "clientes": []}


def test_busca_por_nome_traz_a_continua_aberta(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "30.00")
    continua = nota_continua_aberta(cliente, usuario, "70.00", criada_em=_ha(9))
    _pagar(continua, usuario, "20.00")
    criar_cliente(nome="Mário Lima")
    clientes = logado.get("/api/busca", {"q": "ma"}).json()["clientes"]
    por_nome = {c["nome"]: c for c in clientes}
    assert por_nome["Maria da Silva"]["continua_aberta"] == {
        "codigo": "01-02", "saldo": "50.00", "dias_em_aberto": 9,
    }
    assert por_nome["Mário Lima"]["continua_aberta"] is None
    assert por_nome["Maria da Silva"]["divida"] == "80.00"


def test_busca_por_nome_ignora_continua_fechada_e_nota_unica(logado, cliente, usuario):
    continua = nota_continua_aberta(cliente, usuario, "70.00")
    fechar_nota(nota=continua, versao=continua.versao)
    nota_unica_fechada(cliente, usuario, "30.00")
    clientes = logado.get("/api/busca", {"q": "maria"}).json()["clientes"]
    assert clientes[0]["continua_aberta"] is None


def test_lista_de_clientes_nao_traz_a_continua_aberta(logado, cliente, usuario):
    nota_continua_aberta(cliente, usuario, "70.00")
    assert "continua_aberta" not in logado.get("/api/clientes").json()[0]


def _consultas_da_busca(logado, termo):
    with CaptureQueriesContext(connection) as feitas:
        logado.get("/api/busca", {"q": termo})
    return len(feitas)


def test_busca_por_nome_nao_faz_consulta_por_cliente(logado, usuario):
    nota_continua_aberta(criar_cliente(nome="Cliente 0"), usuario)
    com_um = _consultas_da_busca(logado, "cliente")
    for indice in range(1, 4):
        nota_continua_aberta(criar_cliente(nome=f"Cliente {indice}"), usuario)
    assert _consultas_da_busca(logado, "cliente") == com_um


def test_pagas(logado, cliente, usuario):
    agora = timezone.now()
    _pagar(nota_unica_fechada(cliente, usuario, "10.00"), usuario, "10.00", agora=agora - timedelta(days=6))
    _pagar(nota_unica_fechada(cliente, usuario, "20.00"), usuario, "20.00", agora=agora - timedelta(days=8))
    corpo = logado.get("/api/pagas").json()
    assert [n["codigo"] for n in corpo] == ["01-01"]
    assert corpo[0]["quitada_em"] is not None
    assert corpo[0]["imprimir_url"] == "/notas/1-1/imprimir/"


def test_leitura_exige_login(client, cliente):
    for caminho in ["/api/painel", "/api/busca?q=1", "/api/clientes", "/api/clientes/1", "/api/notas/1-1", "/api/pagas", "/api/itens/sugestoes?q=ra"]:
        assert client.get(caminho).status_code == 401


def _lancar(cliente, usuario, *descricoes):
    nota = criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    for descricao in descricoes:
        nota = adicionar_item(
            nota=nota,
            versao=nota.versao,
            descricao=descricao,
            quantidade=Decimal("1"),
            preco_unitario=Decimal("10.00"),
            usuario=usuario,
        )


def _sugestoes(logado, termo):
    return logado.get("/api/itens/sugestoes", {"q": termo}).json()["sugestoes"]


def test_sugestoes_ignoram_acento_e_caixa_e_casam_inicio_de_palavra(logado, cliente, usuario):
    _lancar(cliente, usuario, "Ração cães 15kg", "Saco de ração", "Coleira", "Arame")
    assert sorted(_sugestoes(logado, "ra")) == ["Ração cães 15kg", "Saco de ração"]
    assert _sugestoes(logado, "RAÇ") == _sugestoes(logado, "ra")
    assert _sugestoes(logado, "racao ca") == ["Ração cães 15kg"]


def test_sugestoes_trazem_as_mais_usadas_primeiro(logado, cliente, usuario):
    _lancar(cliente, usuario, "Ração gatos", "Ração cães", "Ração cães", "Ração aves", "Ração aves", "Ração aves")
    assert _sugestoes(logado, "ra") == ["Ração aves", "Ração cães", "Ração gatos"]


def test_sugestoes_juntam_grafias_iguais_e_mostram_a_mais_usada(logado, cliente, usuario):
    _lancar(cliente, usuario, "racao", "Ração", "Ração", "Milho", "Milho")
    assert _sugestoes(logado, "ra") == ["Ração"]
    assert _sugestoes(logado, "mi") == ["Milho"]
    _lancar(cliente, usuario, "Ração Premium", "Ração Premium", "ração premium")
    assert _sugestoes(logado, "ra") == ["Ração", "Ração Premium"]


def test_sugestoes_limitam_a_8_e_pedem_duas_letras(logado, cliente, usuario):
    _lancar(cliente, usuario, *[f"Ração tipo {indice}" for indice in range(10)])
    assert len(_sugestoes(logado, "ra")) == 8
    assert _sugestoes(logado, "r") == []
    assert _sugestoes(logado, " ") == []
    assert logado.get("/api/itens/sugestoes").json() == {"sugestoes": []}
