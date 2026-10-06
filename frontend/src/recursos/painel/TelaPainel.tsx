import type { NotaResumo } from "../../api/tipos";
import { Aviso } from "../../componentes/Aviso";
import { Dinheiro } from "../../componentes/Dinheiro";
import { EstadoVazio } from "../../componentes/EstadoVazio";
import { Lista } from "../../componentes/Lista";
import { rotuloDeAlerta } from "../../componentes/rotuloDeAlerta";
import { Selo } from "../../componentes/Selo";
import { useAbrirNota } from "../notas/abrirNota";
import { usePainel } from "./painel";
import "./TelaPainel.css";

function LinhaDeNota({ nota, abrir }: { nota: NotaResumo; abrir: (codigo: string) => void }) {
  return (
    <Lista.Item onAbrir={() => abrir(nota.codigo)}>
      {nota.nivel_alerta > 0 ? (
        <Selo nivel={nota.nivel_alerta}>{rotuloDeAlerta(nota.nivel_alerta)}</Selo>
      ) : (
        <Selo tipo="rascunho">Rascunho</Selo>
      )}
      <span className="numero painel__codigo">{nota.codigo}</span>
      <span className="painel__cliente">{nota.cliente.nome}</span>
      <span className="painel__apoio">{nota.tipo_rotulo}</span>
      <span className="painel__apoio">{nota.dias_em_aberto} dias em aberto</span>
      <span className="painel__valor">
        <Dinheiro valor={nota.saldo} />
      </span>
    </Lista.Item>
  );
}

export function TelaPainel() {
  const painel = usePainel();
  const abrirNota = useAbrirNota();

  return (
    <section className="painel">
      <h1 className="painel__titulo">Painel</h1>
      {painel.isError && <Aviso tipo="erro">Não foi possível carregar o painel.</Aviso>}
      {painel.data && (
        <>
          {painel.data.backup_falhou && (
            <Aviso tipo="erro">
              A cópia de segurança de hoje não foi feita. Confira a pasta de cópias e avise o responsável.
            </Aviso>
          )}
          <div className="painel__cartao">
            <span className="painel__rotulo">Fiado em aberto</span>
            <strong className="painel__total">
              <Dinheiro valor={painel.data.total_em_aberto} animar />
            </strong>
          </div>

          <h2 className="painel__secao">Notas atrasadas</h2>
          {painel.data.alertas.length === 0 ? (
            <EstadoVazio>Nenhuma nota atrasada.</EstadoVazio>
          ) : (
            <Lista>
              {painel.data.alertas.map((nota) => (
                <LinhaDeNota key={nota.codigo} nota={nota} abrir={abrirNota} />
              ))}
            </Lista>
          )}

          {painel.data.rascunhos.length > 0 && (
            <>
              <h2 className="painel__secao">Rascunhos não finalizados</h2>
              <Lista>
                {painel.data.rascunhos.map((nota) => (
                  <LinhaDeNota key={nota.codigo} nota={nota} abrir={abrirNota} />
                ))}
              </Lista>
            </>
          )}
        </>
      )}
    </section>
  );
}
