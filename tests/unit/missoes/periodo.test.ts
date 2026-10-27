import { periodoDiario, periodoSemanal } from "@/modules/missoes/periodo";

describe("período diário das missões", () => {
  it("renova à meia-noite em Brasília, não à meia-noite UTC", () => {
    const anterior = periodoDiario(new Date("2026-10-22T02:59:59.999Z"));
    const seguinte = periodoDiario(new Date("2026-10-22T03:00:00.000Z"));
    expect(anterior.inicio.toISOString()).toBe("2026-10-21T03:00:00.000Z");
    expect(anterior.fim.toISOString()).toBe("2026-10-22T03:00:00.000Z");
    expect(seguinte.inicio).toEqual(anterior.fim);
    expect(seguinte.fim.toISOString()).toBe("2026-10-23T03:00:00.000Z");
    expect(seguinte.fusoHorario).toBe("America/Sao_Paulo");
  });

  it("respeita a mudança histórica de horário de verão", () => {
    const periodo = periodoDiario(new Date("2018-11-04T12:00:00Z"));
    expect(periodo.inicio.toISOString()).toBe("2018-11-04T03:00:00.000Z");
    expect(periodo.fim.toISOString()).toBe("2018-11-05T02:00:00.000Z");
  });

  it("atravessa a virada de ano", () => {
    const periodo = periodoDiario(new Date("2026-12-31T18:00:00Z"));
    expect(periodo.fim.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("período semanal das missões", () => {
  it("renova na segunda-feira à meia-noite em Brasília", () => {
    const domingo = periodoSemanal(new Date("2026-10-26T02:59:59.999Z"));
    const segunda = periodoSemanal(new Date("2026-10-26T03:00:00.000Z"));
    expect(domingo.inicio.toISOString()).toBe("2026-10-19T03:00:00.000Z");
    expect(domingo.fim.toISOString()).toBe("2026-10-26T03:00:00.000Z");
    expect(segunda.inicio).toEqual(domingo.fim);
    expect(segunda.fim.toISOString()).toBe("2026-11-02T03:00:00.000Z");
  });

  it("mantém a semana civil durante uma mudança de horário de verão", () => {
    const periodo = periodoSemanal(new Date("2018-11-04T12:00:00Z"));
    expect(periodo.inicio.toISOString()).toBe("2018-10-29T03:00:00.000Z");
    expect(periodo.fim.toISOString()).toBe("2018-11-05T02:00:00.000Z");
  });
});
