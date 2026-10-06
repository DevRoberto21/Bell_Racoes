import { formatarData } from "../../api/data";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { Dinheiro } from "../../componentes/Dinheiro";
import { EstadoVazio } from "../../componentes/EstadoVazio";
import { FalhaDeConsulta } from "../../componentes/FalhaDeConsulta";
import { Lista } from "../../componentes/Lista";
import { useTitulo } from "../estrutura/titulo";
import { useAbrirNota } from "../notas/abrirNota";
import { mensagemDeErro } from "../notas/notas";
import { usePagas, useReimprimir } from "./pagas";
import "./TelaPagas.css";

export function TelaPagas() {
  useTitulo("Contas pagas");
  const pagas = usePagas();
  const reimprimir = useReimprimir();
  const abrirNota = useAbrirNota();

  return (
    <section className="pagas">
      <h1 className="pagas__titulo">Contas pagas</h1>
      <p className="pagas__explicacao">
        Notas quitadas nos últimos 7 dias. As mais antigas continuam guardadas e abrem pelo código na busca.
      </p>
      {pagas.isError && (
        <FalhaDeConsulta erro={pagas.error} mensagem="Não foi possível carregar as contas pagas." aoTentar={() => void pagas.refetch()} />
      )}
      {reimprimir.isError && <Aviso tipo="erro">{mensagemDeErro(reimprimir.error)}</Aviso>}
      {pagas.data &&
        (pagas.data.length === 0 ? (
          <EstadoVazio>Nenhuma nota quitada nos últimos 7 dias.</EstadoVazio>
        ) : (
          <Lista>
            {pagas.data.map((nota) => (
              <Lista.Item
                key={nota.codigo}
                onAbrir={() => abrirNota(nota.codigo)}
                acao={
                  <Botao
                    variante="contorno"
                    disabled={reimprimir.isPending && reimprimir.variables === nota.codigo}
                    onClick={() => reimprimir.mutate(nota.codigo)}
                  >
                    Reimprimir
                  </Botao>
                }
              >
                <span className="numero pagas__codigo">{nota.codigo}</span>
                <span className="pagas__cliente">{nota.cliente.nome}</span>
                <span className="pagas__apoio">{nota.tipo_rotulo}</span>
                {nota.quitada_em && <span className="pagas__apoio numero">quitada em {formatarData(nota.quitada_em)}</span>}
                <span className="pagas__valor">
                  <Dinheiro valor={nota.total} />
                </span>
              </Lista.Item>
            ))}
          </Lista>
        ))}
    </section>
  );
}
