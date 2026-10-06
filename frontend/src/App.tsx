import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { BrowserRouter } from "react-router";
import { ErroApi } from "./api/http";
import { Rotas } from "./rotas";

const clienteDeConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (tentativas, erro) =>
        !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) && tentativas < 2,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={clienteDeConsultas}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Rotas />
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  );
}
