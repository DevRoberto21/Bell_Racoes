import { Route, Routes } from "react-router";
import { Botao } from "./componentes/Botao";
import { RotaProtegida } from "./recursos/sessao/RotaProtegida";
import { useSair, useSessao } from "./recursos/sessao/sessao";
import { TelaEntrar } from "./recursos/sessao/TelaEntrar";

function TelaInicial() {
  const sessao = useSessao();
  const sair = useSair();
  const usuario = sessao.data?.usuario;
  return (
    <main style={{ padding: "var(--espaco-5)" }}>
      <p>Olá, {usuario?.nome || usuario?.nome_de_usuario}.</p>
      <Botao variante="contorno" carregando={sair.isPending} onClick={() => sair.mutate()}>
        Sair
      </Botao>
    </main>
  );
}

export function Rotas() {
  return (
    <Routes>
      <Route path="/entrar" element={<TelaEntrar />} />
      <Route element={<RotaProtegida />}>
        <Route path="/" element={<TelaInicial />} />
      </Route>
    </Routes>
  );
}
