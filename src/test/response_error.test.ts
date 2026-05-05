import Response from "../app/common/app/response";

function buildMockResponse(headersSent = false) {
  const response = {
    headersSent,
    locals: {},
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };

  return response as unknown as Parameters<typeof Response.error>[0] & {
    locals: Record<string, unknown>;
    status: jest.Mock;
    send: jest.Mock;
  };
}

describe("Response.error", () => {
  test("marque l'erreur comme deja traitee pour eviter une double reponse globale", () => {
    const res = buildMockResponse();

    Response.error(res, "Erreur metier", 400, new Error("details internes"));

    expect(res.locals.errorHandled).toBe(true);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Erreur metier",
        data: null,
        status: expect.objectContaining({
          code: 400,
          success: false,
          message: "Erreur metier",
        }),
      }),
    );
  });

  test("ne renvoie rien si les headers sont deja envoyes", () => {
    const res = buildMockResponse(true);

    Response.error(res, "Erreur tardive", 500, new Error("late"));

    expect(res.locals.errorHandled).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});
