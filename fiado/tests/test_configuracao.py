from django.conf import settings


def test_sqlite_com_gravacao_imediata_e_durabilidade_total():
    opcoes = settings.DATABASES["default"]["OPTIONS"]
    assert opcoes["transaction_mode"] == "IMMEDIATE"
    assert "journal_mode=WAL" in opcoes["init_command"]
    assert "synchronous=FULL" in opcoes["init_command"]
