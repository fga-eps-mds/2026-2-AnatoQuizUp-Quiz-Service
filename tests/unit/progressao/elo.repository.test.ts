import { EloXp, EstadoElo, TipoEventoElo, TipoNotificacaoElo } from "@prisma/client";

import { prisma } from "@/config/db";
import {
  aplicarInatividade,
  aplicarInatividadeEmLote,
  buscarConfiguracao,
  creditarXp,
  listarHistoricoElo,
  listarNotificacoes,
  marcarNotificacaoLida,
  montarRetratoInatividade,
  salvarConfiguracao,
} from "@/modules/progressao/elo.repository";

jest.mock("@/config/db", () => ({
  prisma: {
    $transaction: jest.fn(),
    progressoXp: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    eventoElo: { create: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    notificacaoElo: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    configuracaoInatividade: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-10-26T12:00:00.000Z");

const CONFIG_PADRAO = {
  diasAviso: 7,
  diasRisco: 8,
  diasRebaixamento: 9,
  diasEntreRebaixamentos: 14,
  indisponibilidades: [],
  atualizadoPorId: null,
  atualizadoEm: AGORA,
};

// Transacao fake: o callback recebe o proprio client mockado.
const tx = {
  $executeRaw: jest.fn(),
  progressoXp: prisma.progressoXp,
  eventoElo: prisma.eventoElo,
  notificacaoElo: prisma.notificacaoElo,
};

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation(async (arg) =>
    typeof arg === "function" ? await arg(tx) : await Promise.all(arg),
  );
  (prisma.configuracaoInatividade.findUnique as jest.Mock).mockResolvedValue(CONFIG_PADRAO);
  (prisma.notificacaoElo.createMany as jest.Mock).mockResolvedValue({ count: 1 });
  (prisma.eventoElo.create as jest.Mock).mockResolvedValue({ id: "evento-1" });
  (prisma.eventoElo.createMany as jest.Mock).mockResolvedValue({ count: 1 });
});

describe("creditarXp", () => {
  it("soma nos dois saldos e registra a atividade valida, zerando a contagem", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue({
      eloAtual: EloXp.CURIOSO,
      maiorElo: EloXp.CURIOSO,
    });
    (prisma.progressoXp.upsert as jest.Mock).mockResolvedValue({ xpTotal: 135, xpElo: 135 });

    const resultado = await creditarXp(tx as never, "aluno-1", 35, AGORA);

    expect(prisma.progressoXp.upsert).toHaveBeenCalledWith({
      where: { usuarioId: "aluno-1" },
      create: { usuarioId: "aluno-1", xpTotal: 35, xpElo: 35, ultimaAtividadeEm: AGORA },
      update: {
        xpTotal: { increment: 35 },
        xpElo: { increment: 35 },
        ultimaAtividadeEm: AGORA,
        rebaixamentosAplicados: 0,
      },
      select: { xpTotal: true, xpElo: true },
    });
    // Os avisos do ciclo que acabou nao devem reaparecer no proximo login.
    expect(prisma.notificacaoElo.updateMany).toHaveBeenCalledWith({
      where: {
        usuarioId: "aluno-1",
        lidaEm: null,
        tipo: {
          in: [
            TipoNotificacaoElo.AVISO_PREVENTIVO,
            TipoNotificacaoElo.ELO_EM_RISCO,
            TipoNotificacaoElo.VESPERA_REBAIXAMENTO,
          ],
        },
      },
      data: { lidaEm: AGORA },
    });
    expect(resultado).toEqual({
      xpTotal: 135,
      xpElo: 135,
      eloAtual: EloXp.CURIOSO,
      maiorElo: EloXp.CURIOSO,
      eventoElo: null,
      eloAnterior: EloXp.CURIOSO,
    });
    expect(prisma.eventoElo.create).not.toHaveBeenCalled();
  });

  it("recupera um elo perdido, preserva o maior elo e notifica o aluno", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue({
      eloAtual: EloXp.R1,
      maiorElo: EloXp.R3,
    });
    (prisma.progressoXp.upsert as jest.Mock).mockResolvedValue({ xpTotal: 7020, xpElo: 6020 });

    const resultado = await creditarXp(tx as never, "aluno-1", 21, AGORA);

    expect(resultado.eloAtual).toBe(EloXp.R3);
    expect(resultado.maiorElo).toBe(EloXp.R3);
    expect(resultado.eventoElo).toBe(TipoEventoElo.RECUPERACAO);
    expect(prisma.progressoXp.update).toHaveBeenCalledWith({
      where: { usuarioId: "aluno-1" },
      data: { eloAtual: EloXp.R3, maiorElo: EloXp.R3 },
    });
    expect(prisma.eventoElo.create).toHaveBeenCalledWith({
      data: {
        usuarioId: "aluno-1",
        tipo: TipoEventoElo.RECUPERACAO,
        eloAnterior: EloXp.R1,
        eloNovo: EloXp.R3,
        xpEloAntes: 5999,
        xpEloDepois: 6020,
      },
      select: { id: true },
    });
    expect(prisma.notificacaoElo.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          usuarioId: "aluno-1",
          tipo: TipoNotificacaoElo.ELO_RECUPERADO,
          chave: `${EloXp.R3}:evento-1`,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("promove para um elo inedito sem notificar (celebrado na tela do quiz)", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue({
      eloAtual: EloXp.R3,
      maiorElo: EloXp.R3,
    });
    (prisma.progressoXp.upsert as jest.Mock).mockResolvedValue({ xpTotal: 10000, xpElo: 10000 });

    const resultado = await creditarXp(tx as never, "aluno-1", 50, AGORA);

    expect(resultado.eventoElo).toBe(TipoEventoElo.PROMOCAO);
    expect(resultado.maiorElo).toBe(EloXp.R6);
    expect(prisma.notificacaoElo.createMany).not.toHaveBeenCalled();
  });

  it("credito de missao nao reinicia a contagem de inatividade", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue({
      eloAtual: EloXp.R3,
      maiorElo: EloXp.R3,
    });
    (prisma.progressoXp.upsert as jest.Mock).mockResolvedValue({ xpTotal: 7020, xpElo: 7020 });

    await creditarXp(tx as never, "aluno-1", 20, AGORA, false);

    const chamada = (prisma.progressoXp.upsert as jest.Mock).mock.calls[0][0];
    // Soma nos dois saldos, mas sem tocar na ultima atividade valida.
    expect(chamada.update).toEqual({ xpTotal: { increment: 20 }, xpElo: { increment: 20 } });
    expect(chamada.create).toEqual({ usuarioId: "aluno-1", xpTotal: 20, xpElo: 20 });
    expect(prisma.notificacaoElo.updateMany).not.toHaveBeenCalled();
  });

  it("trata o primeiro credito de um aluno sem registro de progresso", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.progressoXp.upsert as jest.Mock).mockResolvedValue({ xpTotal: 35, xpElo: 35 });

    const resultado = await creditarXp(tx as never, "aluno-novo", 35, AGORA);

    expect(resultado.eloAtual).toBe(EloXp.CURIOSO);
    expect(resultado.eloAnterior).toBe(EloXp.CURIOSO);
  });
});

describe("aplicarInatividade", () => {
  const progressoNoR3 = (dias: number, sobrescritas: Record<string, unknown> = {}) => ({
    xpTotal: 7000,
    xpElo: 7000,
    eloAtual: EloXp.R3,
    maiorElo: EloXp.R3,
    ultimaAtividadeEm: new Date(AGORA.getTime() - dias * DIA),
    rebaixamentosAplicados: 0,
    ...sobrescritas,
  });

  it("toma o lock do aluno antes de avaliar", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue(progressoNoR3(1));

    await aplicarInatividade("aluno-1", AGORA);

    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it("nao grava nada quando o aluno esta ativo", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue(progressoNoR3(1));

    const resultado = await aplicarInatividade("aluno-1", AGORA);

    expect(prisma.progressoXp.update).not.toHaveBeenCalled();
    expect(prisma.eventoElo.createMany).not.toHaveBeenCalled();
    expect(resultado.retrato.estado).toBe(EstadoElo.ATIVO);
    expect(resultado.rebaixamentos).toBe(0);
  });

  it("rebaixa, ajusta o XP de elo e registra historico e avisos", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue(progressoNoR3(9));
    (prisma.notificacaoElo.createMany as jest.Mock).mockResolvedValue({ count: 4 });

    const resultado = await aplicarInatividade("aluno-1", AGORA);

    expect(prisma.progressoXp.update).toHaveBeenCalledWith({
      where: { usuarioId: "aluno-1" },
      data: { eloAtual: EloXp.R1, xpElo: 5999, rebaixamentosAplicados: 1 },
    });
    expect(prisma.eventoElo.createMany).toHaveBeenCalledWith({
      data: [
        {
          usuarioId: "aluno-1",
          tipo: TipoEventoElo.REBAIXAMENTO,
          eloAnterior: EloXp.R3,
          eloNovo: EloXp.R1,
          xpEloAntes: 7000,
          xpEloDepois: 5999,
          diasInatividade: 9,
        },
      ],
    });
    // XP total intacto, maior elo preservado.
    expect(resultado.dados).toEqual({
      xpTotal: 7000,
      xpElo: 5999,
      eloAtual: EloXp.R1,
      maiorElo: EloXp.R3,
    });
    expect(resultado.rebaixamentos).toBe(1);
    expect(resultado.notificacoes).toBe(4);
  });

  it("devolve estado inicial para quem ainda nao tem progresso", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue(null);

    const resultado = await aplicarInatividade("aluno-novo", AGORA);

    expect(resultado.dados.eloAtual).toBe(EloXp.CURIOSO);
    expect(resultado.retrato.prazoRebaixamentoEm).toBeNull();
    expect(prisma.progressoXp.update).not.toHaveBeenCalled();
  });

  it("aceita configuracao injetada sem consultar o banco", async () => {
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue(progressoNoR3(9));

    await aplicarInatividade("aluno-1", AGORA, {
      diasAviso: 20,
      diasRisco: 25,
      diasRebaixamento: 30,
      diasEntreRebaixamentos: 14,
      indisponibilidades: [],
    });

    expect(prisma.configuracaoInatividade.upsert).not.toHaveBeenCalled();
    expect(prisma.progressoXp.update).not.toHaveBeenCalled();
  });
});

describe("aplicarInatividadeEmLote", () => {
  it("avalia apenas quem passou do prazo de aviso e soma os totais", async () => {
    (prisma.progressoXp.findMany as jest.Mock).mockResolvedValue([
      { usuarioId: "aluno-1" },
      { usuarioId: "aluno-2" },
    ]);
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue({
      xpTotal: 7000,
      xpElo: 7000,
      eloAtual: EloXp.R3,
      maiorElo: EloXp.R3,
      ultimaAtividadeEm: new Date(AGORA.getTime() - 9 * DIA),
      rebaixamentosAplicados: 0,
    });
    (prisma.notificacaoElo.createMany as jest.Mock).mockResolvedValue({ count: 4 });

    const resultado = await aplicarInatividadeEmLote(AGORA);

    expect(prisma.progressoXp.findMany).toHaveBeenCalledWith({
      where: {
        ultimaAtividadeEm: { not: null, lte: new Date(AGORA.getTime() - 7 * DIA) },
      },
      select: { usuarioId: true },
      orderBy: { ultimaAtividadeEm: "asc" },
      take: 500,
    });
    expect(resultado).toEqual({
      avaliados: 2,
      rebaixamentos: 2,
      notificacoes: 8,
      pendentes: false,
    });
  });

  it("nao faz nada quando ninguem esta inativo", async () => {
    (prisma.progressoXp.findMany as jest.Mock).mockResolvedValue([]);

    await expect(aplicarInatividadeEmLote(AGORA)).resolves.toEqual({
      avaliados: 0,
      rebaixamentos: 0,
      notificacoes: 0,
      pendentes: false,
    });
  });

  it("sinaliza pendentes quando o lote enche, para o agendador chamar de novo", async () => {
    (prisma.progressoXp.findMany as jest.Mock).mockResolvedValue([{ usuarioId: "aluno-1" }]);
    (prisma.progressoXp.findUnique as jest.Mock).mockResolvedValue({
      xpTotal: 7000,
      xpElo: 7000,
      eloAtual: EloXp.R3,
      maiorElo: EloXp.R3,
      ultimaAtividadeEm: new Date(AGORA.getTime() - 1 * DIA),
      rebaixamentosAplicados: 0,
    });

    const resultado = await aplicarInatividadeEmLote(AGORA, 1);

    expect(prisma.progressoXp.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
    expect(resultado.pendentes).toBe(true);
  });
});

describe("montarRetratoInatividade", () => {
  it("descreve o estado sem gravar nada", () => {
    const retrato = montarRetratoInatividade(
      {
        xpElo: 7000,
        eloAtual: EloXp.R3,
        maiorElo: EloXp.R3,
        ultimaAtividadeEm: new Date(AGORA.getTime() - 8 * DIA),
        rebaixamentosAplicados: 0,
      },
      AGORA,
      {
        diasAviso: 7,
        diasRisco: 8,
        diasRebaixamento: 9,
        diasEntreRebaixamentos: 14,
        indisponibilidades: [],
      },
    );

    expect(retrato.estado).toBe(EstadoElo.EM_RISCO);
    expect(retrato.diasInatividade).toBe(8);
    expect(retrato.prazoRebaixamentoEm?.toISOString()).toBe(
      new Date(AGORA.getTime() + DIA).toISOString(),
    );
  });
});

describe("configuracao de inatividade", () => {
  it("le a linha unica sem escrever no banco", async () => {
    const config = await buscarConfiguracao();

    expect(prisma.configuracaoInatividade.findUnique).toHaveBeenCalledWith({
      where: { id: "global" },
    });
    expect(prisma.configuracaoInatividade.upsert).not.toHaveBeenCalled();
    expect(config).toEqual({
      diasAviso: 7,
      diasRisco: 8,
      diasRebaixamento: 9,
      diasEntreRebaixamentos: 14,
      indisponibilidades: [],
    });
  });

  it("devolve os padroes da US quando nenhum administrador gravou prazos", async () => {
    (prisma.configuracaoInatividade.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(buscarConfiguracao()).resolves.toEqual({
      diasAviso: 7,
      diasRisco: 8,
      diasRebaixamento: 9,
      diasEntreRebaixamentos: 14,
      indisponibilidades: [],
    });
    expect(prisma.configuracaoInatividade.upsert).not.toHaveBeenCalled();
  });

  it("normaliza as janelas de indisponibilidade e descarta entradas invalidas", async () => {
    (prisma.configuracaoInatividade.findUnique as jest.Mock).mockResolvedValue({
      ...CONFIG_PADRAO,
      indisponibilidades: [
        { inicio: "2026-10-01T00:00:00.000Z", fim: "2026-10-02T00:00:00.000Z" },
        { inicio: "2026-10-05T00:00:00.000Z", fim: "2026-10-04T00:00:00.000Z" },
        { inicio: "data-invalida", fim: "2026-10-04T00:00:00.000Z" },
        { fim: "2026-10-04T00:00:00.000Z" },
        "nao-e-objeto",
        null,
      ],
    });

    const config = await buscarConfiguracao();

    expect(config.indisponibilidades).toEqual([
      { inicio: new Date("2026-10-01T00:00:00.000Z"), fim: new Date("2026-10-02T00:00:00.000Z") },
    ]);
  });

  it("trata um JSON que nao seja lista como ausencia de indisponibilidades", async () => {
    (prisma.configuracaoInatividade.findUnique as jest.Mock).mockResolvedValue({
      ...CONFIG_PADRAO,
      indisponibilidades: { inicio: "x" },
    });

    await expect(buscarConfiguracao()).resolves.toMatchObject({ indisponibilidades: [] });
  });

  it("grava os novos prazos registrando o administrador responsavel", async () => {
    const dados = {
      diasAviso: 10,
      diasRisco: 12,
      diasRebaixamento: 15,
      diasEntreRebaixamentos: 20,
      indisponibilidades: [],
    };

    await salvarConfiguracao(dados, "admin-1");

    expect(prisma.configuracaoInatividade.upsert).toHaveBeenCalledWith({
      where: { id: "global" },
      create: { ...dados, atualizadoPorId: "admin-1" },
      update: { ...dados, atualizadoPorId: "admin-1" },
    });
  });
});

describe("historico e notificacoes", () => {
  it("lista o historico de elo paginado, mais recente primeiro", async () => {
    (prisma.eventoElo.findMany as jest.Mock).mockResolvedValue([{ id: "evento-1" }]);
    (prisma.eventoElo.count as jest.Mock).mockResolvedValue(1);

    await expect(listarHistoricoElo("aluno-1", { page: 2, limit: 5, skip: 5 })).resolves.toEqual({
      data: [{ id: "evento-1" }],
      total: 1,
    });
    expect(prisma.eventoElo.findMany).toHaveBeenCalledWith({
      where: { usuarioId: "aluno-1" },
      orderBy: { criadoEm: "desc" },
      skip: 5,
      take: 5,
    });
  });

  it("restringe a listagem de avisos ao destinatario e ao filtro de nao lidos", async () => {
    (prisma.notificacaoElo.findMany as jest.Mock).mockResolvedValue([]);

    await listarNotificacoes("aluno-1", true);

    expect(prisma.notificacaoElo.findMany).toHaveBeenCalledWith({
      where: { usuarioId: "aluno-1", lidaEm: null },
      orderBy: { criadoEm: "desc" },
    });

    await listarNotificacoes("aluno-1");

    expect(prisma.notificacaoElo.findMany).toHaveBeenLastCalledWith({
      where: { usuarioId: "aluno-1" },
      orderBy: { criadoEm: "desc" },
    });
  });

  it("marca como lido somente o aviso do proprio aluno", async () => {
    (prisma.notificacaoElo.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await expect(marcarNotificacaoLida("aviso-1", "aluno-1")).resolves.toBe(true);
    expect(prisma.notificacaoElo.updateMany).toHaveBeenCalledWith({
      where: { id: "aviso-1", usuarioId: "aluno-1", lidaEm: null },
      data: { lidaEm: expect.any(Date) },
    });
  });

  it("e idempotente quando o aviso ja estava lido", async () => {
    (prisma.notificacaoElo.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.notificacaoElo.count as jest.Mock).mockResolvedValue(1);

    await expect(marcarNotificacaoLida("aviso-1", "aluno-1")).resolves.toBe(true);
  });

  it("recusa o aviso de outro aluno", async () => {
    (prisma.notificacaoElo.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.notificacaoElo.count as jest.Mock).mockResolvedValue(0);

    await expect(marcarNotificacaoLida("aviso-1", "outro-aluno")).resolves.toBe(false);
  });
});
