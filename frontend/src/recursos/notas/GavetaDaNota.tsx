import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { formatarData } from "../../api/data";
import { ErroApi } from "../../api/http";
import type { ItemNota, Nota } from "../../api/tipos";
import { useAtalho } from "../../atalhos/atalhos";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { Dialogo } from "../../componentes/Dialogo";
import { FalhaDeConsulta } from "../../componentes/FalhaDeConsulta";
import { Gaveta } from "../../componentes/Gaveta";
import { Selo } from "../../componentes/Selo";
import { molaBase } from "../../estilo/tempo";
import { useNotaAberta } from "./abrirNota";
import { Correcao } from "./Correcao";
import { abrirImpressao } from "./imprimir";
import { ItensDaNota } from "./ItensDaNota";
import { LinhaNovoItem } from "./LinhaNovoItem";
import {
  tratarErroDeNota,
  useAdicionarItem,
  useCorrigir,
  useDescartar,
  useFechar,
  useFinalizar,
  useNota,
  useReceber,
  useRemoverItem,
} from "./notas";
import { Receber } from "./Receber";
import { ResumoDaNota } from "./ResumoDaNota";
import "./GavetaDaNota.css";

/** Gaveta da nota indicada por ?nota=12-03. Montada uma vez na estrutura; fechar tira `nota` do endereço. */
export function GavetaDaNota() {
  const codigo = useNotaAberta();
  const [, definirParametros] = useSearchParams();
  // `exibido` é o último código aberto: a gaveta ainda tem o que mostrar enquanto desliza para fora.
  // `abertura` conta as aberturas: cada uma começa do zero, mesmo repetindo o código.
  const [vista, setVista] = useState({ atual: codigo, exibido: codigo, abertura: 0 });
  if (codigo !== vista.atual) {
    setVista({
      atual: codigo,
      exibido: codigo ?? vista.exibido,
      abertura: codigo === null ? vista.abertura : vista.abertura + 1,
    });
  }

  const fechar = useCallback(
    () =>
      definirParametros((atuais) => {
        const novos = new URLSearchParams(atuais);
        novos.delete("nota");
        return novos;
      }),
    [definirParametros],
  );

  if (vista.exibido === null) return null;
  // A chave troca tudo a cada abertura: nenhum dado, erro ou confirmação de uma nota (ou de uma abertura
  // anterior do mesmo código, que pode já ser outra nota depois de um descarte) aparece na seguinte.
  return (
    <NotaNaGaveta
      key={`${vista.exibido}#${vista.abertura}`}
      codigo={vista.exibido}
      aberta={codigo !== null && codigo === vista.exibido}
      aoFechar={fechar}
    />
  );
}

interface Props {
  codigo: string;
  aberta: boolean;
  aoFechar: () => void;
}

function NotaNaGaveta({ codigo, aberta, aoFechar }: Props) {
  const clienteDeConsulta = useQueryClient();
  const [descartando, setDescartando] = useState(false);
  // Fechada ou em descarte, a gaveta para de observar a nota: assim uma nota descartada nunca é buscada de novo.
  const consulta = useNota(aberta && !descartando ? codigo : null);
  // Última nota carregada: é o que aparece durante o descarte e enquanto a gaveta sai.
  const [nota, setNota] = useState<Nota>();
  if (consulta.data && consulta.data !== nota) setNota(consulta.data);

  const adicionar = useAdicionarItem(codigo);
  const remover = useRemoverItem(codigo);
  const finalizar = useFinalizar(codigo);
  const fecharNota = useFechar(codigo);
  const descartar = useDescartar(codigo);
  const receber = useReceber(codigo);
  const corrigir = useCorrigir(codigo);
  const gravando =
    adicionar.isPending ||
    remover.isPending ||
    finalizar.isPending ||
    fecharNota.isPending ||
    descartar.isPending ||
    receber.isPending ||
    corrigir.isPending;

  const [falha, setFalha] = useState<string | null>(null);
  const [itemARemover, setItemARemover] = useState<ItemNota | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  // Em "receber" e "corrigir" o formulário do modo toma o lugar das ações do rodapé.
  const [modo, setModo] = useState<"ver" | "receber" | "corrigir">("ver");

  const falhar = (erro: unknown) => setFalha(tratarErroDeNota(clienteDeConsulta, erro, codigo));
  const entrarEm = (novo: "receber" | "corrigir") => {
    setFalha(null);
    setModo(novo);
  };
  /** Erro de Receber ou Correção: o conflito (409) volta à leitura com o aviso; os demais ficam com o formulário. */
  const falharNoModo = (erro: unknown) => {
    if (!(erro instanceof ErroApi && erro.status === 409)) throw erro;
    falhar(erro);
    setModo("ver");
  };
  const naoEncontrada = consulta.error instanceof ErroApi && consulta.error.status === 404;
  // R faz o mesmo que o botão Receber do rodapé, e só quando ele está na tela e destravado.
  useAtalho("r", () => entrarEm("receber"), {
    ativo:
      aberta &&
      modo === "ver" &&
      !naoEncontrada &&
      nota?.acoes.receber === true &&
      !gravando &&
      itemARemover === null &&
      !confirmandoDescarte,
  });

  function conteudo() {
    if (naoEncontrada) {
      return (
        <div className="nota__ausente">
          <p>Nota não encontrada.</p>
          <Botao variante="contorno" onClick={aoFechar}>
            Fechar
          </Botao>
        </div>
      );
    }
    if (!nota) {
      if (consulta.isError) {
        return <FalhaDeConsulta erro={consulta.error} mensagem="Não foi possível carregar a nota." aoTentar={() => void consulta.refetch()} />;
      }
      return (
        <p className="nota__apoio" role="status">
          Carregando…
        </p>
      );
    }
    const { acoes } = nota;
    return (
      <div className="nota" data-modo={modo}>
        <header className="nota__cabecalho">
          <Link className="nota__cliente" to={`/clientes/${nota.cliente.codigo}`}>
            {nota.cliente.codigo_formatado} · {nota.cliente.nome}
          </Link>
          <p className="nota__dados">
            <span>{nota.tipo_rotulo}</span>
            {nota.quitada_em === null && <span>{nota.situacao_rotulo}</span>}
            {nota.editada && <Selo tipo="editado">Editado</Selo>}
            {nota.quitada_em !== null && <Selo tipo="quitada">Quitada</Selo>}
            <span className="nota__apoio numero">
              {nota.quitada_em !== null
                ? `quitada em ${formatarData(nota.quitada_em)}`
                : `${nota.dias_em_aberto} ${nota.dias_em_aberto === 1 ? "dia" : "dias"}`}
            </span>
          </p>
        </header>

        {modo === "corrigir" ? (
          <Correcao
            itens={nota.itens}
            aoCancelar={() => setModo("ver")}
            aoSalvar={(itens) =>
              corrigir.mutateAsync(itens).then((corrigida) => {
                abrirImpressao(corrigida.imprimir_url);
                setModo("ver");
              }, falharNoModo)
            }
          />
        ) : (
          <ItensDaNota itens={nota.itens} aoRemover={acoes.remover_item ? setItemARemover : undefined} bloqueado={gravando}>
            {acoes.adicionar_item && modo === "ver" && (
              <LinhaNovoItem
                bloqueado={gravando}
                aoAdicionar={(dados) => {
                  setFalha(null);
                  return adicionar.mutateAsync(dados).catch((erro: unknown) => {
                    falhar(erro);
                    throw erro;
                  });
                }}
              />
            )}
          </ItensDaNota>
        )}

        <ResumoDaNota pagamentos={nota.pagamentos} total={nota.total} totalPago={nota.total_pago} saldo={nota.saldo} />

        {modo === "receber" && (
          <Receber
            saldo={nota.saldo}
            aoCancelar={() => setModo("ver")}
            aoConfirmar={(dados) =>
              receber.mutateAsync(dados).then(({ recibo_url }) => {
                abrirImpressao(recibo_url);
                setModo("ver");
              }, falharNoModo)
            }
          />
        )}
      </div>
    );
  }

  function rodape() {
    if (!nota || naoEncontrada || modo !== "ver") return undefined;
    const { acoes } = nota;
    if (!Object.values(acoes).some(Boolean)) return undefined;
    return (
      <>
        {acoes.descartar && (
          <Botao variante="perigo" disabled={gravando} onClick={() => setConfirmandoDescarte(true)}>
            Descartar
          </Botao>
        )}
        {acoes.imprimir && (
          <Botao variante="contorno" onClick={() => abrirImpressao(nota.imprimir_url)}>
            Reimprimir
          </Botao>
        )}
        {acoes.corrigir && (
          <Botao variante="contorno" disabled={gravando} onClick={() => entrarEm("corrigir")}>
            Correção
          </Botao>
        )}
        {acoes.fechar && (
          <Botao
            variante="contorno"
            disabled={gravando}
            onClick={() => {
              setFalha(null);
              fecharNota.mutate(undefined, { onError: falhar });
            }}
          >
            Fechar nota
          </Botao>
        )}
        {acoes.receber && (
          <Botao disabled={gravando} onClick={() => entrarEm("receber")}>
            Receber
          </Botao>
        )}
        {acoes.finalizar && (
          <Botao
            disabled={gravando}
            onClick={() => {
              setFalha(null);
              finalizar.mutate(undefined, {
                onSuccess: (finalizada) => abrirImpressao(finalizada.imprimir_url),
                onError: falhar,
              });
            }}
          >
            Finalizar e imprimir
          </Botao>
        )}
      </>
    );
  }

  return (
    <>
      <Gaveta aberta={aberta} titulo={`Nota ${codigo}`} aoFechar={aoFechar} rodape={rodape()}>
        {falha && (
          <motion.div
            className="nota__falha"
            initial={{ opacity: 0, y: "-50%" }}
            animate={{ opacity: 1, y: 0 }}
            transition={molaBase()}
          >
            <Aviso tipo="erro">{falha}</Aviso>
          </motion.div>
        )}
        {conteudo()}
      </Gaveta>

      <Dialogo.Confirmacao
        aberto={itemARemover !== null}
        titulo="Remover item"
        mensagem="Remover este item?"
        rotuloConfirmar="Remover"
        perigo
        carregando={remover.isPending}
        aoFechar={() => setItemARemover(null)}
        aoConfirmar={() => {
          if (itemARemover === null) return;
          setFalha(null);
          remover.mutate(itemARemover.id, {
            onError: falhar,
            onSettled: () => setItemARemover(null),
          });
        }}
      />

      <Dialogo.Confirmacao
        aberto={confirmandoDescarte}
        titulo="Descartar nota"
        mensagem="Descartar esta nota? Não dá para desfazer."
        rotuloConfirmar="Descartar"
        perigo
        carregando={descartar.isPending}
        aoFechar={() => setConfirmandoDescarte(false)}
        aoConfirmar={() => {
          setFalha(null);
          setDescartando(true);
          descartar.mutate(undefined, {
            onSuccess: () => {
              setConfirmandoDescarte(false);
              aoFechar();
            },
            onError: (erro) => {
              setDescartando(false);
              setConfirmandoDescarte(false);
              falhar(erro);
            },
          });
        }}
      />
    </>
  );
}
