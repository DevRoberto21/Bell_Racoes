from decimal import Decimal

from django import forms

from fiado.models import Cliente


class ClienteForm(forms.ModelForm):
    class Meta:
        model = Cliente
        fields = ["nome", "apelido", "telefone"]


class ItemForm(forms.Form):
    descricao = forms.CharField(label="Descrição", max_length=120)
    quantidade = forms.DecimalField(
        label="Quantidade", max_digits=9, decimal_places=3, min_value=Decimal("0.001"), localize=True
    )
    preco_unitario = forms.DecimalField(
        label="Preço", max_digits=10, decimal_places=2, min_value=Decimal("0.01"), localize=True
    )
