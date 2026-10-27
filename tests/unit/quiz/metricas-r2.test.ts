import { prisma } from "@/config/db";
import { buscarMetricasProdutoR2 } from "@/modules/quiz/metricas-r2";
import { schemaMetricasProdutoR2 } from "@/modules/quiz/quiz.schemas";

jest.mock("@/config/db", () => ({ prisma: { $queryRaw: jest.fn() } }));

describe("métricas agregadas da R2", () => {
  const inicio = new Date("2026-09-28T03:00:00.000Z");
  const fim = new Date("2026-10-26T03:00:00.000Z");

  beforeEach(() => jest.clearAllMocks());

  it("calcula conclusão, acerto e retorno sem IDs individuais", async () => {
    const consulta = prisma.$queryRaw as jest.Mock;
    consulta.mockResolvedValueOnce([{ iniciados: 10, concluidos: 8, questoes: 80, acertos: 60 }]);
    consulta.mockResolvedValueOnce([{ elegiveis: 5, retornaram: 2 }]);

    const resultado = await buscarMetricasProdutoR2(inicio, fim);

    expect(resultado.quizzes.taxaConclusao).toBe(80);
    expect(resultado.questoes.taxaAcerto).toBe(75);
    expect(resultado.retornoSeteDias.taxaRetorno).toBe(40);
    expect(JSON.stringify(resultado)).not.toContain("usuarioId");
  });

  it("não inventa taxas quando não há dados", async () => {
    const consulta = prisma.$queryRaw as jest.Mock;
    consulta.mockResolvedValueOnce([{ iniciados: 0, concluidos: 0, questoes: 0, acertos: 0 }]);
    consulta.mockResolvedValueOnce([{ elegiveis: 0, retornaram: 0 }]);
    const resultado = await buscarMetricasProdutoR2(inicio, fim);
    expect(resultado.quizzes.taxaConclusao).toBeNull();
    expect(resultado.questoes.taxaAcerto).toBeNull();
    expect(resultado.retornoSeteDias.taxaRetorno).toBeNull();
  });

  it("rejeita intervalo vazio ou maior que 90 dias", () => {
    expect(schemaMetricasProdutoR2.safeParse({ inicio: "2026-10-26T00:00:00-03:00", fim: "2026-10-26T00:00:00-03:00" }).success).toBe(false);
    expect(schemaMetricasProdutoR2.safeParse({ inicio: "2026-01-01T00:00:00-03:00", fim: "2026-10-26T00:00:00-03:00" }).success).toBe(false);
  });
});
