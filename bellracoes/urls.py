from django.urls import include, path

urlpatterns = [
    path("api/", include("fiado.api.urls")),
    path("", include("fiado.urls")),
]
