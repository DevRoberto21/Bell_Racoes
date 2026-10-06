import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { Campo } from "../../componentes/Campo";
import { useTitulo } from "../estrutura/titulo";
import { useEntrar } from "./sessao";
import "./TelaEntrar.css";

function destinoSeguro(destino: string | null): string {
  // Só caminhos internos: "//site" e "/\site" levam o navegador para outro site.
  if (!destino || !destino.startsWith("/")) return "/";
  return destino[1] === "/" || destino[1] === "\\" ? "/" : destino;
}

// As páginas de impressão são do Django: o roteador do front não as conhece.
function eDoServidor(destino: string): boolean {
  return destino.startsWith("/notas/") || destino.startsWith("/recibos/");
}

export function TelaEntrar() {
  useTitulo("Entrar");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const entrar = useEntrar();

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    entrar.mutate(
      { usuario, senha },
      {
        onSuccess: () => {
          // "depois" vem do front; "next" vem do redirecionamento do Django.
          const destino = destinoSeguro(parametros.get("depois") ?? parametros.get("next"));
          if (eDoServidor(destino)) window.location.assign(destino);
          else navegar(destino, { replace: true });
        },
      },
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
