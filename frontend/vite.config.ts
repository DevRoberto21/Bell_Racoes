/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const django = "http://127.0.0.1:8000";
// Em forma de objeto o proxy mantém o Host do Vite (a forma curta, só com o endereço, troca pelo
// do Django). Assim Host e Origin batem e a verificação de CSRF aceita as escritas.
const paraODjango = { target: django };

// Em produção os arquivos saem em /static/app/ (servidos pelo Django); a aplicação
// continua respondendo na raiz. Em desenvolvimento tudo fica na raiz do Vite.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/static/app/" : "/",
  plugins: [react()],
  server: {
    proxy: { "/api": paraODjango, "/notas": paraODjango, "/recibos": paraODjango },
  },
  test: { environment: "jsdom", setupFiles: ["./src/teste/preparar.ts"], globals: true, css: false },
}));
