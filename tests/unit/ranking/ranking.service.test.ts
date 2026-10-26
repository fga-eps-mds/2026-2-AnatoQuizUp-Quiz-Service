import { EloXp } from "@prisma/client";

import {
  RankingService,
  compararPontuacoes,
} from "../../../src/modules/ranking/ranking.service";
import { RankingRepository } from "../../../src/modules/ranking/ranking.repository";
import type { PontuacaoUsuario } from "../../../src/modules/ranking/ranking.types";

jest.mock("../../../src/modules/ranking/ranking.repository");

describe("RankingService.obterPontuacoes", () => {
  let service: RankingService;
  let repositoryMock: jest.Mocked<RankingRepository>;

  beforeEach(() => {
    repositoryMock = new RankingRepository() as jest.Mocked<RankingRepository>;
    service = new RankingService(repositoryMock);
  });

  it("converte bigint para number, formata a data, calcula o elo e ordena", async () => {
    repositoryMock.agregarPontuacoes.mockResolvedValue([
      { usuarioId: "u1", acertos: 2n, respondidas: 4n, ultimaAtividade: new Date("2026-01-01T00:00:00.000Z"), xpTotal: 0 },
      { usuarioId: "u2", acertos: 5n, respondidas: 6n, ultimaAtividade: null, xpTotal: null },
    ]);

    const resultado = await service.obterPontuacoes();

    expect(resultado[0]).toEqual({
      usuarioId: "u2",
      xpTotal: 0,
      nivel: 1,
      elo: "Curioso",
      totalAcertos: 5,
      totalRespondidas: 6,
      ultimaAtividade: null,
    });
    expect(resultado[1]).toEqual({
      usuarioId: "u1",
      xpTotal: 0,
      nivel: 1,
      elo: "Curioso",
      totalAcertos: 2,
      totalRespondidas: 4,
      ultimaAtividade: "2026-01-01T00:00:00.000Z",
    });
  });

  it("ordena por XP antes dos acertos e calcula nivel e elo de cada usuario", async () => {
    repositoryMock.agregarPontuacoes.mockResolvedValue([
      { usuarioId: "muitos-acertos", acertos: 50n, respondidas: 60n, ultimaAtividade: null, xpTotal: 90 },
      { usuarioId: "mais-xp", acertos: 10n, respondidas: 20n, ultimaAtividade: null, xpTotal: 1520n, eloAtual: EloXp.INTERNO, maiorElo: EloXp.INTERNO },
    ]);

    const resultado = await service.obterPontuacoes();

    expect(resultado.map((linha) => linha.usuarioId)).toEqual(["mais-xp", "muitos-acertos"]);
    expect(resultado[0]).toMatchObject({ xpTotal: 1520, nivel: 6, elo: "Interno" });
    expect(resultado[1]).toMatchObject({ xpTotal: 90, nivel: 1, elo: "Curioso" });
  });

  it("exibe o elo atual rebaixado, nao o maior elo conquistado", async () => {
    repositoryMock.agregarPontuacoes.mockResolvedValue([
      {
        usuarioId: "rebaixado",
        acertos: 10n,
        respondidas: 20n,
        ultimaAtividade: null,
        xpTotal: 7000n,
        eloAtual: EloXp.R1,
        maiorElo: EloXp.R3,
      },
    ]);

    const [linha] = await service.obterPontuacoes();

    // O XP total (base da ordenacao) nao muda com o rebaixamento; o elo exibido, sim.
    expect(linha).toMatchObject({ xpTotal: 7000, elo: "R1" });
  });

  it("repassa a lista de ids ao repositorio", async () => {
    repositoryMock.agregarPontuacoes.mockResolvedValue([]);

    await service.obterPontuacoes(["a", "b"]);

    expect(repositoryMock.agregarPontuacoes).toHaveBeenCalledWith(["a", "b"]);
  });
});

describe("compararPontuacoes", () => {
  const base: PontuacaoUsuario = {
    usuarioId: "x",
    xpTotal: 0,
    nivel: 1,
    elo: "Curioso",
    totalAcertos: 0,
    totalRespondidas: 0,
    ultimaAtividade: null,
  };

  it("coloca quem tem mais XP na frente, mesmo com menos acertos", () => {
    const maisXp = { ...base, xpTotal: 200, totalAcertos: 1 };
    const maisAcertos = { ...base, xpTotal: 100, totalAcertos: 9 };
    expect(compararPontuacoes(maisXp, maisAcertos)).toBeLessThan(0);
    expect(compararPontuacoes(maisAcertos, maisXp)).toBeGreaterThan(0);
  });

  it("coloca quem tem mais acertos na frente", () => {
    expect(compararPontuacoes({ ...base, totalAcertos: 1 }, { ...base, totalAcertos: 2 })).toBeGreaterThan(0);
    expect(compararPontuacoes({ ...base, totalAcertos: 3 }, { ...base, totalAcertos: 2 })).toBeLessThan(0);
  });

  it("desempata por menos questoes respondidas", () => {
    const a = { ...base, totalAcertos: 2, totalRespondidas: 5 };
    const b = { ...base, totalAcertos: 2, totalRespondidas: 3 };
    expect(compararPontuacoes(a, b)).toBeGreaterThan(0);
  });

  it("desempata pela atividade mais antiga e trata null como infinito", () => {
    const antiga = { ...base, ultimaAtividade: "2026-01-01T00:00:00.000Z" };
    const recente = { ...base, ultimaAtividade: "2026-02-01T00:00:00.000Z" };
    expect(compararPontuacoes(antiga, recente)).toBeLessThan(0);
    expect(compararPontuacoes(antiga, { ...base })).toBeLessThan(0);
    expect(compararPontuacoes({ ...base }, antiga)).toBeGreaterThan(0);
    expect(compararPontuacoes({ ...antiga }, { ...antiga })).toBe(0);
  });
});
