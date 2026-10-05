from django.urls import path

from fiado.views import painel

urlpatterns = [
    path("", painel.painel, name="painel"),
]
