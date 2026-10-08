import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErroApi } from "../../api/http";
import { FormularioCliente } from "./FormularioCliente";

describe("FormularioCliente", () => {
  it("envia os três campos preenchidos", async () => {
    const usuario = userEvent.setup();
    const aoEnviar = vi.fn().mockResolvedValue(undefined);
    render(<FormularioCliente rotuloEnviar="Criar" aoEnviar={aoEnviar} aoCancelar={() => {}} />);
    await usuario.type(screen.getByLabelText("Nome"), "José Pereira");
    await usuario.type(screen.getByLabelText("Apelido"), "Zé");
    await usuario.type(screen.getByLabelText("Telefone"), "11999990000");
    await usuario.click(screen.getByRole("button", { name: "Criar" }));
    expect(aoEnviar).toHaveBeenCalledWith({ nome: "José Pereira", apelido: "Zé", telefone: "(11)99999-0000" });
  });

  it("começa com os valores iniciais", () => {
    render(
      <FormularioCliente
        inicial={{ nome: "Maria", apelido: "Mari", telefone: "123" }}
        rotuloEnviar="Salvar"
        aoEnviar={vi.fn()}
        aoCancelar={() => {}}
      />,
    );
    expect(screen.getByLabelText("Nome")).toHaveValue("Maria");
    expect(screen.getByLabelText("Apelido")).toHaveValue("Mari");
  });

  it("liga o erro de campo ao campo e mostra a mensagem geral num aviso", async () => {
    const usuario = userEvent.setup();
    const aoEnviar = vi
      .fn()
      .mockRejectedValue(new ErroApi("Confira os dados.", 400, { nome: "Preencha este campo." }));
    render(<FormularioCliente rotuloEnviar="Criar" aoEnviar={aoEnviar} aoCancelar={() => {}} />);
    await usuario.click(screen.getByRole("button", { name: "Criar" }));
    const campo = await screen.findByLabelText("Nome");
    expect(campo).toHaveAccessibleDescription("Preencha este campo.");
    expect(campo).toBeInvalid();
    expect(screen.getByRole("alert")).toHaveTextContent("Confira os dados.");
  });

  it("Cancelar chama aoCancelar", async () => {
    const usuario = userEvent.setup();
    const aoCancelar = vi.fn();
    render(<FormularioCliente rotuloEnviar="Criar" aoEnviar={vi.fn()} aoCancelar={aoCancelar} />);
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(aoCancelar).toHaveBeenCalled();
  });

  it("mostra a máscara enquanto digita", async () => {
    const usuario = userEvent.setup();
    render(<FormularioCliente rotuloEnviar="Criar" aoEnviar={vi.fn()} aoCancelar={() => {}} />);
    const campo = screen.getByLabelText("Telefone");
    await usuario.type(campo, "11912345");
    expect(campo).toHaveValue("(11)91234-5");
  });

  it("não envia telefone incompleto e mostra o erro até digitar de novo", async () => {
    const usuario = userEvent.setup();
    const aoEnviar = vi.fn().mockResolvedValue(undefined);
    render(<FormularioCliente rotuloEnviar="Criar" aoEnviar={aoEnviar} aoCancelar={() => {}} />);
    await usuario.type(screen.getByLabelText("Nome"), "Ana");
    await usuario.type(screen.getByLabelText("Telefone"), "1191234");
    await usuario.click(screen.getByRole("button", { name: "Criar" }));
    expect(aoEnviar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Telefone")).toHaveAccessibleDescription("Telefone incompleto. Use (dd)9xxxx-xxxx.");
    await usuario.type(screen.getByLabelText("Telefone"), "5");
    expect(screen.getByLabelText("Telefone")).not.toHaveAccessibleDescription("Telefone incompleto. Use (dd)9xxxx-xxxx.");
  });

  it("envia o telefone completo formatado", async () => {
    const usuario = userEvent.setup();
    const aoEnviar = vi.fn().mockResolvedValue(undefined);
    render(<FormularioCliente rotuloEnviar="Criar" aoEnviar={aoEnviar} aoCancelar={() => {}} />);
    await usuario.type(screen.getByLabelText("Nome"), "Ana");
    await usuario.type(screen.getByLabelText("Telefone"), "11912345678");
    await usuario.click(screen.getByRole("button", { name: "Criar" }));
    expect(aoEnviar).toHaveBeenCalledWith({ nome: "Ana", apelido: "", telefone: "(11)91234-5678" });
  });

  it("envia com telefone vazio", async () => {
    const usuario = userEvent.setup();
    const aoEnviar = vi.fn().mockResolvedValue(undefined);
    render(<FormularioCliente rotuloEnviar="Criar" aoEnviar={aoEnviar} aoCancelar={() => {}} />);
    await usuario.type(screen.getByLabelText("Nome"), "Ana");
    await usuario.click(screen.getByRole("button", { name: "Criar" }));
    expect(aoEnviar).toHaveBeenCalledWith({ nome: "Ana", apelido: "", telefone: "" });
  });

  it("mostra o valor inicial já com máscara", () => {
    render(
      <FormularioCliente
        inicial={{ nome: "Maria", apelido: "", telefone: "11912345678" }}
        rotuloEnviar="Salvar"
        aoEnviar={vi.fn()}
        aoCancelar={() => {}}
      />,
    );
    expect(screen.getByLabelText("Telefone")).toHaveValue("(11)91234-5678");
  });
});
