import { useState, type FormEvent } from "react";
import { ErroApi } from "../../api/http";
import { formatarDinheiro, paraDecimal } from "../../api/numero";
import type { ClienteDetalhe, FormaPagamento } from "../../api/tipos";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { Campo } from "../../componentes/Campo";
import { CampoForma } from "../../componentes/CampoForma";
import { Dialogo } from "../../componentes/Dialogo";
import { Dinheiro } from "../../componentes/Dinheiro";
import { abrirImpressao } from "../notas/imprimir";
import { mensagemDeErro } from "../notas/notas";
import { usePagarDivida, usePreviaDivida } from "./clientes";
import "./PagarDivida.css";

interface Props {
  cliente: ClienteDetalhe;
  aberto: boolean;
  aoFechar: () => void;
}

const ERRO_NUMERO = "Número inválido.";

/** Diálogo que recebe um valor e o distribui pelas notas em aberto do cliente. */
export function PagarDivida({ cliente, aberto, aoFechar }: Props) {
  // Estado próprio, e não o `isPending` da mutação: trava já no clique, antes de qualquer outro evento.
  const [enviando, setEnviando] = useState(false);
  return (
    // Com o pagamento a caminho nada fecha o diálogo: a resposta decide o que acontece.
    <Dialogo aberto={aberto} titulo="Pagar dívida total" aoFechar={enviando ? () => {} : aoFechar}>
      <Formulario cliente={cliente} enviando={enviando} setEnviando={setEnviando} aoFechar={aoFechar} />
    </Dialogo>
  );
}

interface PropsFormulario {
  cliente: ClienteDetalhe;
  enviando: boolean;
  setEnviando: (enviando: boolean) => void;
  aoFechar: () => void;
}

/** Montado a cada abertura do diálogo: o valor começa sempre pela dívida. */
function Formulario({ cliente, enviando, setEnviando, aoFechar }: PropsFormulario) {
  const pagar = usePagarDivida(String(cliente.codigo));
  const [dividaVista, setDividaVista] = useState(cliente.divida);
  const [valor, setValor] = useState(() => formatarDinheiro(cliente.divida));
  const [forma, setForma] = useState<FormaPagamento>("DINHEIRO");
  const [erroDoValor, setErroDoValor] = useState<string>();
  const [falha, setFalha] = useState<string>();
  // A dívida mudou com o diálogo aberto (depois de um 409, o cliente é recarregado): o valor volta a ser a dívida toda.
  if (cliente.divida !== dividaVista) {
    setDividaVista(cliente.divida);
    setValor(formatarDinheiro(cliente.divida));
    setErroDoValor(undefined);
  }

  const decimal = paraDecimal(valor, 2);
  const { previa } = usePreviaDivida(String(cliente.codigo), decimal);
  // Comparação de texto com o que o servidor devolve: nenhuma conta com dinheiro aqui.
  const sobrou = previa !== undefined && previa.sobra !== "0.00";

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando || sobrou) return;
    setFalha(undefined);
    setErroDoValor(decimal === null ? ERRO_NUMERO : undefined);
    if (decimal === null) return;
    setEnviando(true);
    pagar.mutate(
      { valor: decimal, forma, divida_esperada: cliente.divida },
      {
        onSuccess: ({ recibo_url }) => {
          abrirImpressao(recibo_url);
          aoFechar();
        },
        onError: (erro) => {
          setFalha(mensagemDeErro(erro));
          if (erro instanceof ErroApi) setErroDoValor(erro.campos.valor);
        },
        onSettled: () => setEnviando(false),
      },
    );
  }

  return (
    <form className="pagar-divida" noValidate onSubmit={enviar}>
      <p className="pagar-divida__divida">
        <span>Dívida</span>
        <strong>
          <Dinheiro valor={cliente.divida} />
        </strong>
      </p>
      {falha && <Aviso tipo="erro">{falha}</Aviso>}
      <div className="pagar-divida__campos">
        <Campo
          rotulo="Valor"
          name="valor"
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          erro={erroDoValor}
          onChange={(e) => {
            setValor(e.target.value);
            setErroDoValor(undefined);
          }}
        />
        <CampoForma valor={forma} aoMudar={setForma} />
      </div>
      {previa && (
        <table className="pagar-divida__previa">
          <thead>
            <tr>
              <th scope="col">Nota</th>
              <th scope="col">Saldo</th>
              <th scope="col">Abate</th>
            </tr>
          </thead>
          <tbody>
            {previa.partes.map((parte) => (
              <tr key={parte.codigo}>
                <td className="numero">{parte.codigo}</td>
                <td>
                  <Dinheiro valor={parte.saldo} />
                </td>
                <td>
                  <Dinheiro valor={parte.parte} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sobrou && <Aviso tipo="erro">O valor é maior que a dívida do cliente.</Aviso>}
      <div className="dialogo__acoes">
        <Botao variante="contorno" onClick={aoFechar} disabled={enviando}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={enviando || sobrou}>
          Confirmar pagamento
        </Botao>
      </div>
    </form>
  );
}
