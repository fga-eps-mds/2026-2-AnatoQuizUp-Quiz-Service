import {
  schemaConfiguracaoInatividade,
  schemaHistoricoXp,
  schemaIniciarTentativa,
  schemaListarNotificacoes,
  schemaParamsNotificacao,
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

  it("exige o id da notificacao nos params", () => {
    expect(schemaParamsNotificacao.safeParse({ id: "aviso-1" }).success).toBe(true);
    expect(schemaParamsNotificacao.safeParse({ id: "  " }).success).toBe(false);
  });

  it("converte o filtro de notificacoes nao lidas para booleano", () => {
    expect(schemaListarNotificacoes.safeParse({ apenasNaoLidas: "true" }).data).toEqual({
      apenasNaoLidas: true,
    });
    expect(schemaListarNotificacoes.safeParse({ apenasNaoLidas: "false" }).data).toEqual({
      apenasNaoLidas: false,
    });
    expect(schemaListarNotificacoes.safeParse({}).data).toEqual({ apenasNaoLidas: false });
    expect(schemaListarNotificacoes.safeParse({ apenasNaoLidas: "sim" }).success).toBe(false);
  });
});

describe("Schema da configuracao de inatividade", () => {
  const valida = {
    diasAviso: 7,
    diasRisco: 8,
    diasRebaixamento: 9,
    diasEntreRebaixamentos: 14,
  };

  it("aceita os prazos padrao e assume lista vazia de indisponibilidades", () => {
    const resultado = schemaConfiguracaoInatividade.safeParse(valida);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.indisponibilidades).toEqual([]);
  });

  it("converte numeros enviados como texto", () => {
    const resultado = schemaConfiguracaoInatividade.safeParse({
      diasAviso: "7",
      diasRisco: "8",
      diasRebaixamento: "9",
      diasEntreRebaixamentos: "14",
    });

    expect(resultado.data?.diasAviso).toBe(7);
  });

  it("rejeita prazos fora de ordem", () => {
    expect(
      schemaConfiguracaoInatividade.safeParse({ ...valida, diasAviso: 9, diasRisco: 8 }).success,
    ).toBe(false);
    expect(
      schemaConfiguracaoInatividade.safeParse({ ...valida, diasRisco: 9, diasRebaixamento: 9 })
        .success,
    ).toBe(false);
  });

  it("rejeita prazos nao inteiros ou fora da faixa permitida", () => {
    expect(schemaConfiguracaoInatividade.safeParse({ ...valida, diasAviso: 0 }).success).toBe(false);
    expect(schemaConfiguracaoInatividade.safeParse({ ...valida, diasAviso: 1.5 }).success).toBe(
      false,
    );
    expect(
      schemaConfiguracaoInatividade.safeParse({ ...valida, diasEntreRebaixamentos: 400 }).success,
    ).toBe(false);
  });

  it("aceita janelas de indisponibilidade validas e rejeita as invertidas", () => {
    expect(
      schemaConfiguracaoInatividade.safeParse({
        ...valida,
        indisponibilidades: [
          { inicio: "2026-10-01T00:00:00.000Z", fim: "2026-10-02T00:00:00.000Z" },
        ],
      }).success,
    ).toBe(true);

    expect(
      schemaConfiguracaoInatividade.safeParse({
        ...valida,
        indisponibilidades: [
          { inicio: "2026-10-02T00:00:00.000Z", fim: "2026-10-01T00:00:00.000Z" },
        ],
      }).success,
    ).toBe(false);

    expect(
      schemaConfiguracaoInatividade.safeParse({
        ...valida,
        indisponibilidades: [{ inicio: "01/10/2026", fim: "02/10/2026" }],
      }).success,
    ).toBe(false);
  });
});
