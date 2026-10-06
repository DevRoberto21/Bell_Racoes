import { formatarData } from "../../api/data";
import type { Pagamento } from "../../api/tipos";
import { Dinheiro } from "../../componentes/Dinheiro";
import "./ResumoDaNota.css";

interface Props {
  pagamentos: Pagamento[];
  total: string;
  totalPago: string;
  saldo: string;
}

/** Pagamentos recebidos (quando houver) e os três totais da nota. */
export function ResumoDaNota({ pagamentos, total, totalPago, saldo }: Props) {
  return (
    <section className="resumo">
      {pagamentos.length > 0 && (
        <>
          <h3 className="resumo__titulo">Pagamentos</h3>
          <ul className="resumo__pagamentos">
            {pagamentos.map((pagamento) => (
              <li key={pagamento.id} className="resumo__pagamento">
                <span className="numero">{formatarData(pagamento.recebido_em)}</span>
                <span>{pagamento.forma_rotulo}</span>
                <span className="resumo__apoio">{pagamento.recebido_por}</span>
                <span className="resumo__valor">
                  <Dinheiro valor={pagamento.valor} />
                </span>
                <a className="resumo__recibo" href={pagamento.recibo_url} target="_blank" rel="noopener noreferrer">
                  Recibo
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <dl className="resumo__totais">
        <div className="resumo__linha">
          <dt>Total</dt>
          <dd>
            <Dinheiro valor={total} animar />
          </dd>
        </div>
        <div className="resumo__linha">
          <dt>Pago</dt>
          <dd>
            <Dinheiro valor={totalPago} animar />
          </dd>
        </div>
        <div className="resumo__linha resumo__linha--saldo">
          <dt>Saldo</dt>
          <dd>
            <Dinheiro valor={saldo} animar />
          </dd>
        </div>
      </dl>
    </section>
  );
}
