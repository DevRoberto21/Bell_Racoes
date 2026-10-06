import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { Campo } from "../../componentes/Campo";
import { useEntrar } from "./sessao";
import "./TelaEntrar.css";

function destinoSeguro(depois: string | null): string {
  // Só caminhos internos: evita redirecionar para outro site.
  return depois && depois.startsWith("/") && !depois.startsWith("//") ? depois : "/";
}

export function TelaEntrar() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const entrar = useEntrar();

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    entrar.mutate(
      { usuario, senha },
      { onSuccess: () => navegar(destinoSeguro(parametros.get("depois")), { replace: true }) },
    );
  }

  return (
    <main className="entrar">
      <form className="entrar__cartao" onSubmit={enviar}>
        <h1 className="entrar__nome">Bell Rações</h1>
        <p className="entrar__apoio">Entre para abrir o fiado.</p>
        {entrar.error && <Aviso tipo="erro">{entrar.error.message}</Aviso>}
        <Campo
          rotulo="Usuário"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus
        />
        <Campo
          rotulo="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Botao type="submit" carregando={entrar.isPending}>
          Entrar
        </Botao>
      </form>
    </main>
  );
}
