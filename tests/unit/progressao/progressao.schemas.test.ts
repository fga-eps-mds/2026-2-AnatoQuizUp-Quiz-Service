import {
  schemaHistoricoXp,
  schemaIniciarTentativa,
  schemaParamsTentativa,
} from "@/modules/progressao/progressao.schemas";

describe("Schemas de progressao", () => {
  it("aceita iniciar rodada com tema e dificuldade", () => {
    const resultado = schemaIniciarTentativa.safeParse({ tema: " Neuroanatomia ", dificuldade: "FACIL" });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ tema: "Neuroanatomia", dificuldade: "FACIL" });
  });

  it("aceita iniciar rodada sem filtros", () => {
    expect(schemaIniciarTentativa.safeParse({}).success).toBe(true);
  });

  it("rejeita dificuldade invalida e tema vazio", () => {
    expect(schemaIniciarTentativa.safeParse({ dificuldade: "IMPOSSIVEL" }).success).toBe(false);
    expect(schemaIniciarTentativa.safeParse({ tema: "   " }).success).toBe(false);
  });

  it("exige o id da rodada nos params", () => {
    expect(schemaParamsTentativa.safeParse({ id: "tentativa-1" }).success).toBe(true);
    expect(schemaParamsTentativa.safeParse({ id: "" }).success).toBe(false);
  });

  it("converte e limita a paginacao do historico de XP", () => {
    expect(schemaHistoricoXp.safeParse({ page: "2", limit: "20" }).data).toEqual({ page: 2, limit: 20 });
    expect(schemaHistoricoXp.safeParse({ limit: "500" }).success).toBe(false);
    expect(schemaHistoricoXp.safeParse({ page: "0" }).success).toBe(false);
  });
});
