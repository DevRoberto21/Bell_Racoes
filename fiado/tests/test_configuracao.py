from django.conf import settings


def test_sqlite_com_gravacao_imediata_e_durabilidade_total():
    opcoes = settings.DATABASES["default"]["OPTIONS"]
    assert opcoes["transaction_mode"] == "IMMEDIATE"
    assert "journal_mode=WAL" in opcoes["init_command"]
    assert "synchronous=FULL" in opcoes["init_command"]


def test_dados_ficam_ao_lado_do_programa():
    from bellracoes import caminhos

    assert settings.DATA_DIR == caminhos.pasta_do_programa() / "dados"


def test_telas_vem_da_pasta_de_recursos():
    from bellracoes import caminhos

    assert settings.FRONT_DIST == caminhos.pasta_de_recursos() / "frontend" / "dist"


def test_settings_nao_expoe_mais_base_dir():
    assert not hasattr(settings, "BASE_DIR")
