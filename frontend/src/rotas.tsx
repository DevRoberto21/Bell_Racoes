import { Route, Routes } from "react-router";
import { Estrutura } from "./recursos/estrutura/Estrutura";
import { TelaPainel } from "./recursos/painel/TelaPainel";
import { RotaProtegida } from "./recursos/sessao/RotaProtegida";
import { TelaEntrar } from "./recursos/sessao/TelaEntrar";

function Provisoria({ titulo }: { titulo: string }) {
  return <h1 style={{ fontSize: "var(--texto-titulo)", fontWeight: "var(--peso-titulo)" }}>{titulo}</h1>;
}

export function Rotas() {
  return (
    <Routes>
      <Route path="/entrar" element={<TelaEntrar />} />
      <Route element={<RotaProtegida />}>
        <Route element={<Estrutura />}>
          <Route path="/" element={<TelaPainel />} />
          <Route path="/clientes" element={<Provisoria titulo="Clientes" />} />
          <Route path="/clientes/:codigo" element={<Provisoria titulo="Cliente" />} />
          <Route path="/pagas" element={<Provisoria titulo="Contas pagas" />} />
        </Route>
      </Route>
    </Routes>
  );
}
