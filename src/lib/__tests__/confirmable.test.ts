import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { ConfirmationDeclined, withConfirmation } from "@/lib/confirmable";

const conflict = () =>
  new ApiError(409, {
    error_code: "horario_ocupado",
    message: "O profissional já tem um atendimento agendado.",
    request_id: "r1",
    confirm_field: "allow_overlap",
  });

describe("withConfirmation", () => {
  it("refaz a chamada com o campo de confirmação quando a pessoa confirma", async () => {
    const run = vi.fn().mockRejectedValueOnce(conflict()).mockResolvedValueOnce("ok");
    await expect(withConfirmation(run, () => true)).resolves.toBe("ok");
    expect(run).toHaveBeenNthCalledWith(2, { allow_overlap: true });
  });

  it("não refaz quando a pessoa desiste", async () => {
    const run = vi.fn().mockRejectedValue(conflict());
    await expect(withConfirmation(run, () => false)).rejects.toBeInstanceOf(ConfirmationDeclined);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("outros erros passam direto", async () => {
    const err = new ApiError(422, { error_code: "dados_invalidos", message: "x", request_id: "r" });
    await expect(withConfirmation(() => Promise.reject(err), () => true)).rejects.toBe(err);
  });
});
