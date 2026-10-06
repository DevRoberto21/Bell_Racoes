import { useState, type FormEvent } from "react";
import { ErroApi } from "../../api/http";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { Campo } from "../../componentes/Campo";
import type { DadosCliente } from "./clientes";
import "./FormularioCliente.css";

interface Props {
  inicial?: DadosCliente;
  rotuloEnviar: string;
  aoEnviar: (dados: DadosCliente) => Promise<unknown>;
  aoCancelar: () => void;
}

export function FormularioCliente({ inicial, rotuloEnviar, aoEnviar, aoCancelar }: Props) {
  const [dados, setDados] = useState<DadosCliente>(inicial ?? { nome: "", apelido: "", telefone: "" });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo: keyof DadosCliente) => (e: { target: { value: string } }) =>
    setDados((atuais) => ({ ...atuais, [campo]: e.target.value }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await aoEnviar(dados);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha : new ErroApi("Não foi possível salvar.", 0));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="formulario-cliente" onSubmit={enviar} noValidate>
      {erro && <Aviso tipo="erro">{erro.message}</Aviso>}
      <Campo rotulo="Nome" value={dados.nome} onChange={mudar("nome")} erro={erro?.campos.nome} autoComplete="off" />
      <Campo rotulo="Apelido" value={dados.apelido} onChange={mudar("apelido")} erro={erro?.campos.apelido} autoComplete="off" />
      <Campo rotulo="Telefone" value={dados.telefone} onChange={mudar("telefone")} erro={erro?.campos.telefone} autoComplete="off" />
      <div className="formulario-cliente__acoes">
        <Botao variante="contorno" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" carregando={enviando}>
          {rotuloEnviar}
        </Botao>
      </div>
    </form>
  );
}
