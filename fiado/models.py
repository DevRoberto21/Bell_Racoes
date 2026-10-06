import unicodedata
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q, Sum
from django.urls import reverse
from django.utils import timezone

CENTAVO = Decimal("0.01")


def subtotal_de(quantidade, preco_unitario):
    return (quantidade * preco_unitario).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def normalizar(texto):
    """Minúsculas, sem acento e sem espaço sobrando. Usado em busca e ordenação."""
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def _dinheiro(valor):
    return (valor or Decimal("0")).quantize(CENTAVO)


class Sequencia(models.Model):
    """Contador que só cresce. Garante que um código nunca seja reaproveitado."""

    nome = models.CharField(max_length=30, unique=True)
    valor = models.PositiveIntegerField(default=0)


class Cliente(models.Model):
    codigo = models.PositiveIntegerField(unique=True, editable=False)
    nome = models.CharField(max_length=120)
    apelido = models.CharField(max_length=60, blank=True)
    telefone = models.CharField(max_length=20, blank=True)
    ultimo_numero_nota = models.PositiveIntegerField(default=0, editable=False)
    texto_busca = models.CharField(max_length=200, editable=False, db_index=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["texto_busca", "codigo"]

    def __str__(self):
        return f"{self.codigo_formatado} · {self.nome}"

    def save(self, *args, **kwargs):
        self.texto_busca = normalizar(f"{self.nome} {self.apelido}")
        super().save(*args, **kwargs)

    @property
    def codigo_formatado(self):
        return f"{self.codigo:02d}"


class Nota(models.Model):
    class Tipo(models.TextChoices):
        UNICA = "UNICA", "Única"
        CONTINUA = "CONTINUA", "Contínua"

    class Situacao(models.TextChoices):
        RASCUNHO = "RASCUNHO", "Rascunho"
        ABERTA = "ABERTA", "Aberta"
        FECHADA = "FECHADA", "Fechada"
        QUITADA = "QUITADA", "Quitada"

    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name="notas")
    numero = models.PositiveIntegerField()
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    situacao = models.CharField(max_length=10, choices=Situacao.choices)
    criada_em = models.DateTimeField(default=timezone.now)
    fechada_em = models.DateTimeField(null=True, blank=True)
    quitada_em = models.DateTimeField(null=True, blank=True)
    editada = models.BooleanField(default=False)
    editada_em = models.DateTimeField(null=True, blank=True)
    criada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    versao = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["criada_em", "numero"]
        constraints = [
            models.UniqueConstraint(fields=["cliente", "numero"], name="numero_unico_por_cliente"),
            models.UniqueConstraint(
                fields=["cliente"],
                condition=Q(tipo="CONTINUA", situacao="ABERTA"),
                name="uma_continua_aberta_por_cliente",
            ),
        ]

    def __str__(self):
        return self.codigo

    def get_absolute_url(self):
        return f"/clientes/{self.cliente.codigo}?nota={self.codigo}"

    @property
    def codigo(self):
        return f"{self.cliente.codigo:02d}-{self.numero:02d}"

    @property
    def total(self):
        return _dinheiro(self.itens.aggregate(t=Sum("subtotal"))["t"])

    @property
    def total_pago(self):
        return _dinheiro(self.pagamentos.aggregate(t=Sum("valor"))["t"])

    @property
    def saldo(self):
        return self.total - self.total_pago

    @property
    def aceita_itens(self):
        return self.situacao == self.Situacao.RASCUNHO or (
            self.tipo == self.Tipo.CONTINUA and self.situacao == self.Situacao.ABERTA
        )

    @property
    def em_divida(self):
        return self.situacao in (self.Situacao.ABERTA, self.Situacao.FECHADA)

    def dias_em_aberto(self, hoje=None):
        hoje = hoje or timezone.localdate()
        return (hoje - timezone.localtime(self.criada_em).date()).days

    def nivel_alerta(self, hoje=None):
        return self.dias_em_aberto(hoje) // 7


class ItemNota(models.Model):
    nota = models.ForeignKey(Nota, on_delete=models.CASCADE, related_name="itens")
    descricao = models.CharField(max_length=120)
    quantidade = models.DecimalField(max_digits=9, decimal_places=3)
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, editable=False)
    adicionado_em = models.DateTimeField(default=timezone.now)
    adicionado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        ordering = ["adicionado_em", "id"]

    def save(self, *args, **kwargs):
        self.subtotal = subtotal_de(self.quantidade, self.preco_unitario)
        super().save(*args, **kwargs)


class Pagamento(models.Model):
    class Forma(models.TextChoices):
        DINHEIRO = "DINHEIRO", "Dinheiro"
        PIX = "PIX", "Pix"
        CARTAO = "CARTAO", "Cartão"

    nota = models.ForeignKey(Nota, on_delete=models.PROTECT, related_name="pagamentos")
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    forma = models.CharField(max_length=10, choices=Forma.choices)
    recebido_em = models.DateTimeField(default=timezone.now)
    recebido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    lote = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["recebido_em", "id"]


class CorrecaoNota(models.Model):
    nota = models.ForeignKey(Nota, on_delete=models.PROTECT, related_name="correcoes")
    feita_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    feita_em = models.DateTimeField(default=timezone.now)
    itens_anteriores = models.JSONField()
    total_anterior = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["feita_em", "id"]
