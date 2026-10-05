import pytest


@pytest.fixture
def usuario(django_user_model):
    return django_user_model.objects.create_user(
        "caixa1", password="senha-forte-1", first_name="Flávia"
    )


@pytest.fixture
def logado(client, usuario):
    client.force_login(usuario)
    return client


@pytest.fixture
def cliente(db):
    from fiado.servicos.clientes import criar_cliente

    return criar_cliente(nome="Maria da Silva", apelido="Mariinha", telefone="85999990000")


@pytest.fixture(autouse=True)
def sem_backup(settings):
    settings.BACKUP_ATIVO = False
