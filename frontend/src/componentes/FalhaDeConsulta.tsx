import { ErroApi } from "../api/http";
import { Aviso } from "./Aviso";
import { Botao } from "./Botao";
import "./FalhaDeConsulta.css";

interface Props {
  erro: unknown;
  /** Mensagem da tela para os erros que não são falha de rede. */
  mensagem: string;
  aoTentar: () => void;
}

/** Aviso de uma consulta que falhou. Sem rede (status 0), diz isso e oferece tentar de novo. */
export function FalhaDeConsulta({ erro, mensagem, aoTentar }: Props) {
  const semRede = erro instanceof ErroApi && erro.status === 0;
  return (
    <Aviso tipo="erro">
      <span className="falha-de-consulta">
        <span>{semRede ? erro.message : mensagem}</span>
        {semRede && (
          <Botao variante="contorno" onClick={aoTentar}>
            Tentar de novo
          </Botao>
        )}
      </span>
    </Aviso>
  );
}
