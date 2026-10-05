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
