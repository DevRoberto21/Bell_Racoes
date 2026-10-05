import pytest

from fiado.models import Cliente, Nota
from fiado.servicos.clientes import criar_cliente
from fiado.servicos.notas import criar_nota
from fiado.tests.fabrica import nota_unica_fechada

pytestmark = pytest.mark.django_db


def test_lista_em_ordem_alfabetica_com_divida(logado, cliente, usuario):
    criar_cliente(nome="Ana")
    nota_unica_fechada(cliente, usuario, "100.00")
    html = logado.get("/clientes/").content.decode()
    assert html.index("Ana") < html.index("Maria da Silva")
    assert "100,00" in html


def test_lista_filtra_por_apelido(logado, cliente):
    criar_cliente(nome="Ana")
    html = logado.get("/clientes/", {"q": "mariinha"}).content.decode()
    assert "Maria da Silva" in html
    assert "Ana" not in html


def test_cadastrar_cliente(logado):
    resposta = logado.post(
        "/clientes/novo/", {"nome": "João", "apelido": "Jota", "telefone": "8588887777"}
    )
    cliente = Cliente.objects.get()
    assert cliente.codigo == 1
    assert resposta["Location"] == "/clientes/1/"


def test_editar_cliente(logado, cliente):
    logado.post("/clientes/1/editar/", {"nome": "Maria Souza", "apelido": "", "telefone": ""})
    cliente.refresh_from_db()
    assert cliente.nome == "Maria Souza"
    assert cliente.texto_busca == "maria souza"


def test_registro_mostra_notas_em_aberto_e_divida(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "100.00")
    html = logado.get("/clientes/1/").content.decode()
    assert "01 · Maria da Silva" in html
    assert "01-01" in html
    assert "100,00" in html


def test_registro_de_cliente_inexistente_e_404(logado):
    assert logado.get("/clientes/99/").status_code == 404


def test_botao_de_continua_fica_desabilitado_com_uma_aberta(logado, cliente, usuario):
    assert "disabled" not in logado.get("/clientes/1/").content.decode()
    criar_nota(cliente=cliente, tipo=Nota.Tipo.CONTINUA, usuario=usuario)
    assert "disabled" in logado.get("/clientes/1/").content.decode()


def test_nova_nota_abre_a_pagina_da_nota(logado, cliente, usuario):
    resposta = logado.post("/clientes/1/notas/nova/", {"tipo": "UNICA"})
    assert resposta["Location"] == "/notas/1-1/"
    nota = Nota.objects.get()
    assert nota.criada_por == usuario
    assert logado.get("/notas/1-1/").status_code == 200


def test_segunda_continua_mostra_erro(logado, cliente, usuario):
    criar_nota(cliente=cliente, tipo=Nota.Tipo.CONTINUA, usuario=usuario)
    resposta = logado.post("/clientes/1/notas/nova/", {"tipo": "CONTINUA"}, follow=True)
    assert "já tem uma nota contínua aberta" in resposta.content.decode()
    assert Nota.objects.count() == 1


def test_abrir_nota_pelo_numero_no_registro(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario)
    assert logado.post("/clientes/1/nota/", {"numero": "1"})["Location"] == "/notas/1-1/"
    resposta = logado.post("/clientes/1/nota/", {"numero": "9"}, follow=True)
    assert "Nota 01-09 não existe." in resposta.content.decode()


def test_numero_com_digito_nao_ascii_redireciona_sem_erro(logado, cliente):
    resposta = logado.post("/clientes/1/nota/", {"numero": "²"})
    assert resposta.status_code == 302


def test_excluir_cliente_sem_nota(logado, cliente):
    assert logado.post("/clientes/1/excluir/")["Location"] == "/clientes/"
    assert not Cliente.objects.exists()


def test_excluir_cliente_com_nota_mostra_erro(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario)
    resposta = logado.post("/clientes/1/excluir/", follow=True)
    assert "não pode ser excluído" in resposta.content.decode()
    assert Cliente.objects.exists()


def test_busca_por_codigo_de_cliente_foca_no_numero_da_nota(logado, cliente):
    resposta = logado.get("/busca/", {"q": "1"})
    assert resposta["Location"] == "/clientes/1/?foco=nota"
    assert "autofocus" in logado.get("/clientes/1/?foco=nota").content.decode()


def test_busca_por_codigo_de_nota(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario)
    assert logado.get("/busca/", {"q": "01-01"})["Location"] == "/notas/1-1/"


def test_busca_por_nome_vai_para_a_lista(logado, cliente):
    assert logado.get("/busca/", {"q": "maria"})["Location"] == "/clientes/?q=maria"


def test_busca_inexistente_avisa_e_mantem_o_texto(logado, cliente):
    resposta = logado.get("/busca/", {"q": "01-07"}, follow=True)
    html = resposta.content.decode()
    assert "Nota 01-07 não existe." in html
    assert 'value="01-07"' in html


def test_pagina_da_nota_mostra_itens_e_saldo(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "100.00")
    html = logado.get("/notas/1-1/").content.decode()
    assert "Nota 01-01" in html
    assert "Ração 15kg" in html
    assert "Saldo: R$ 100,00" in html


def test_nota_inexistente_e_404(logado, cliente):
    assert logado.get("/notas/1-9/").status_code == 404


def test_telas_exigem_login(client, cliente):
    for caminho in ["/clientes/", "/clientes/1/", "/busca/?q=1"]:
        assert client.get(caminho)["Location"].startswith("/entrar/")


FRASE_RASCUNHO = "Rascunho ainda não é dívida: só entra na conta depois de finalizado."


def test_registro_do_cliente_explica_o_rascunho(logado, cliente, usuario):
    criar_nota(cliente=cliente, tipo=Nota.Tipo.UNICA, usuario=usuario)
    assert FRASE_RASCUNHO in logado.get("/clientes/1/").content.decode()


def test_registro_do_cliente_sem_rascunho_nao_explica(logado, cliente, usuario):
    nota_unica_fechada(cliente, usuario, "10.00")
    assert FRASE_RASCUNHO not in logado.get("/clientes/1/").content.decode()


def test_numero_de_nota_gigante_nao_quebra(logado, cliente):
    resposta = logado.post("/clientes/1/nota/", {"numero": "9" * 5000})
    assert resposta.status_code == 302
