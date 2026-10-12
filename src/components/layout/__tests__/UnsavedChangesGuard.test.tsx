import { useState } from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router-dom";
import { ModalStackProvider } from "@/context/ModalStackContext";
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard";
import { useDirtyOnEdit } from "@/lib/unsavedChanges";

function Shell() {
  return (
    <>
      <Link to="/outra">Ir para outra tela</Link>
      <Outlet />
      <UnsavedChangesGuard />
    </>
  );
}

function FormPage() {
  const [open, setOpen] = useState(true);
  const unsaved = useDirtyOnEdit("o cadastro do convênio", open);
  return (
    <>
      {open && (
        <form onChange={unsaved.onChange} onSubmitCapture={unsaved.onSubmit} onSubmit={(e) => e.preventDefault()}>
          <label>
            Nome
            <input name="nome" />
          </label>
          <button type="submit">Salvar</button>
        </form>
      )}
      <button type="button" onClick={() => setOpen(false)}>
        Cancelar
      </button>
    </>
  );
}

function setup() {
  const router = createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [
          { path: "/inicio", element: <p>Tela inicial</p> },
          { path: "/form", element: <FormPage /> },
          { path: "/outra", element: <p>Outra tela</p> },
        ],
      },
    ],
    { initialEntries: ["/inicio", "/form"], initialIndex: 1 }
  );
  render(
    <ModalStackProvider>
      <RouterProvider router={router} />
    </ModalStackProvider>
  );
  return router;
}

describe("UnsavedChangesGuard com roteador de dados", () => {
  it("sem edição, navega sem perguntar", async () => {
    setup();
    await userEvent.click(screen.getByText("Ir para outra tela"));
    expect(await screen.findByText("Outra tela")).toBeInTheDocument();
  });

  it("botão Voltar do navegador pergunta; Continuar editando fica na tela", async () => {
    const router = setup();
    await userEvent.type(screen.getByLabelText("Nome"), "Unimed");
    await act(() => router.navigate(-1));
    expect(await screen.findByText("Sair sem salvar?")).toBeInTheDocument();
    expect(screen.getByText(/o cadastro do convênio/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(router.state.location.pathname).toBe("/form");
    expect(screen.getByLabelText("Nome")).toHaveValue("Unimed");
  });

  it("link pergunta e Sair sem salvar segue", async () => {
    const router = setup();
    await userEvent.type(screen.getByLabelText("Nome"), "Unimed");
    await userEvent.click(screen.getByText("Ir para outra tela"));
    await userEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));
    expect(await screen.findByText("Outra tela")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/outra");
  });

  it("depois de enviar ou cancelar o formulário, não pergunta mais", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Nome"), "Unimed");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await userEvent.click(screen.getByText("Ir para outra tela"));
    expect(await screen.findByText("Outra tela")).toBeInTheDocument();
  });

  it("fechar o modal (Cancelar) descarta a edição", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Nome"), "Unimed");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByText("Ir para outra tela"));
    expect(await screen.findByText("Outra tela")).toBeInTheDocument();
  });
});
