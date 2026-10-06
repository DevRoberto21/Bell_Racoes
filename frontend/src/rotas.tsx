import { Route, Routes } from "react-router";
import { TelaCliente } from "./recursos/clientes/TelaCliente";
import { TelaClientes } from "./recursos/clientes/TelaClientes";
import { Estrutura } from "./recursos/estrutura/Estrutura";
import { TelaPagas } from "./recursos/pagas/TelaPagas";
import { TelaPainel } from "./recursos/painel/TelaPainel";
import { RotaProtegida } from "./recursos/sessao/RotaProtegida";
import { useSessaoExpirada } from "./recursos/sessao/sessao";
import { TelaEntrar } from "./recursos/sessao/TelaEntrar";

export function Rotas() {
  useSessaoExpirada();
  return (
    <Routes>
      <Route path="/entrar" element={<TelaEntrar />} />
      <Route element={<RotaProtegida />}>
        <Route element={<Estrutura />}>
          <Route path="/" element={<TelaPainel />} />
          <Route path="/clientes" element={<TelaClientes />} />
          <Route path="/clientes/:codigo" element={<TelaCliente />} />
          <Route path="/pagas" element={<TelaPagas />} />
        </Route>
      </Route>
    </Routes>
  );
}
