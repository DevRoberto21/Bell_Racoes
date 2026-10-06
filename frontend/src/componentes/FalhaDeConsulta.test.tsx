import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErroApi } from "../api/http";
import { FalhaDeConsulta } from "./FalhaDeConsulta";

describe("FalhaDeConsulta", () => {
  it("sem rede mostra 'Sem conexão com o servidor.' e o botão Tentar de novo", async () => {
    const aoTentar = vi.fn();
    render(
      <FalhaDeConsulta erro={new ErroApi("Sem conexão com o servidor.", 0)} mensagem="Não foi possível carregar o painel." aoTentar={aoTentar} />,
    );
    const aviso = screen.getByRole("alert");
    expect(aviso).toHaveTextContent("Sem conexão com o servidor.");
    expect(aviso).not.toHaveTextContent("Não foi possível carregar o painel.");
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(aoTentar).toHaveBeenCalledTimes(1);
  });

  it("outro erro mostra a mensagem da tela, sem botão", () => {
    render(<FalhaDeConsulta erro={new ErroApi("Falhou.", 500)} mensagem="Não foi possível carregar o painel." aoTentar={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar o painel.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
