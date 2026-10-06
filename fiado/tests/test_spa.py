import pytest

pytestmark = pytest.mark.django_db

INDICE = '<!doctype html><html><body><div id="root"></div></body></html>'


@pytest.fixture
def front(settings, tmp_path):
    settings.FRONT_DIST = tmp_path
    (tmp_path / "index.html").write_text(INDICE, encoding="utf-8")
    return tmp_path


@pytest.mark.parametrize(
    "caminho", ["/", "/clientes", "/clientes/12", "/pagas", "/entrar", "/qualquer/coisa"]
)
def test_qualquer_caminho_devolve_o_indice_sem_login(client, front, caminho):
    resposta = client.get(caminho)
    assert resposta.status_code == 200
    assert resposta.content.decode() == INDICE


def test_sem_o_front_gerado_devolve_503_com_a_instrucao(client, settings, tmp_path):
    settings.FRONT_DIST = tmp_path
    resposta = client.get("/")
    assert resposta.status_code == 503
    html = resposta.content.decode()
    assert "O front ainda não foi gerado" in html
    assert "npm --prefix frontend run build" in html


def test_api_inexistente_e_404_e_nao_o_indice(client, front):
    resposta = client.get("/api/inexistente")
    assert resposta.status_code == 404
    assert 'id="root"' not in resposta.content.decode()


def test_indice_nao_fica_em_cache(client, front):
    assert client.get("/")["Cache-Control"] == "no-cache"
