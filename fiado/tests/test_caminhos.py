import sys
from pathlib import Path

from bellracoes import caminhos

RAIZ = Path(caminhos.__file__).resolve().parent.parent


def test_em_desenvolvimento_as_duas_pastas_sao_a_raiz_do_projeto():
    assert not caminhos.empacotado()
    assert caminhos.pasta_do_programa() == RAIZ
    assert caminhos.pasta_de_recursos() == RAIZ


def test_empacotado_separa_a_pasta_do_exe_da_pasta_de_recursos(monkeypatch, tmp_path):
    exe = tmp_path / "BellRacoes" / "BellRacoes.exe"
    recursos = tmp_path / "BellRacoes" / "_internal"
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "executable", str(exe))
    monkeypatch.setattr(sys, "_MEIPASS", str(recursos), raising=False)
    assert caminhos.empacotado()
    assert caminhos.pasta_do_programa() == exe.resolve().parent
    assert caminhos.pasta_de_recursos() == recursos
