import { randomInt } from "node:crypto";
import { OrigemXp, TipoMissao, type Dificuldade, type Prisma } from "@prisma/client";
import { prisma } from "@/config/db";
import { periodoDiario } from "./periodo";

type Tx = Prisma.TransactionClient;

// Serializa atribuição e eventos do mesmo aluno, inclusive entre instâncias do serviço.
export async function bloquearMissoes(tx: Tx, usuarioId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${usuarioId}, 84))`;
}

async function obterPeriodo(tx: Tx, usuarioId: string, agora: Date) {
  const { inicio, fim } = periodoDiario(agora);
  let periodo = await tx.periodoMissoes.findUnique({
    where: { usuarioId_periodicidade_inicio: { usuarioId, periodicidade: "DIARIA", inicio } },
  });
  if (periodo) return periodo;
  const catalogo = await tx.missaoCatalogo.findMany({
    where: { ativa: true, periodicidade: "DIARIA" },
    orderBy: { codigo: "asc" },
  });
  // Um catálogo incompleto não deve criar atribuições parciais e permanentes.
  if (catalogo.length < 3) return null;
  for (let i = catalogo.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [catalogo[i], catalogo[j]] = [catalogo[j], catalogo[i]];
  }
  periodo = await tx.periodoMissoes.create({
    data: {
      usuarioId,
      inicio,
      fim,
      missoes: { create: catalogo.slice(0, 3).map((missao) => ({ missaoId: missao.id })) },
    },
  });
  return periodo;
}

async function avancar(
  tx: Tx,
  periodoId: string,
  usuarioId: string,
  tipos: TipoMissao[],
  agora: Date,
) {
  const missoes = await tx.missaoUsuario.findMany({
    where: { periodoId, concluidaEm: null, missao: { tipo: { in: tipos } } },
    include: { missao: true },
  });
  const concluidas: { nome: string; recompensaXp: number }[] = [];
  for (const item of missoes) {
    const progresso = Math.min(item.progresso + 1, item.missao.meta);
    const concluiu = progresso === item.missao.meta;
    await tx.missaoUsuario.update({
      where: { id: item.id },
      data: { progresso, ...(concluiu && { concluidaEm: agora }) },
    });
    if (concluiu) {
      const saldo = await tx.progressoXp.upsert({
        where: { usuarioId },
        create: { usuarioId, xpTotal: item.missao.recompensaXp },
        update: { xpTotal: { increment: item.missao.recompensaXp } },
        select: { xpTotal: true },
      });
      concluidas.push({ nome: item.missao.nome, recompensaXp: item.missao.recompensaXp });
      await tx.transacaoXp.create({
        data: {
          usuarioId,
          missaoUsuarioId: item.id,
          origem: OrigemXp.MISSAO_CONCLUIDA,
          xpBase: item.missao.recompensaXp,
          bonusDesempenho: 0,
          bonusPowerUp: 0,
          quantidade: item.missao.recompensaXp,
          xpTotalApos: saldo.xpTotal,
        },
      });
    }
  }
  return concluidas;
}

export async function contabilizarResposta(
  tx: Tx,
  usuarioId: string,
  questaoId: string,
  correta: boolean,
  agora: Date,
) {
  const periodo = await obterPeriodo(tx, usuarioId, agora);
  if (!periodo) return [];
  const evento = await tx.eventoMissao.createMany({
    data: [{ periodoId: periodo.id, tipo: "RESPOSTA", chave: questaoId }],
    skipDuplicates: true,
  });
  return evento.count
    ? avancar(
        tx,
        periodo.id,
        usuarioId,
        correta
          ? [TipoMissao.RESPONDER_QUESTOES, TipoMissao.ACERTAR_QUESTOES]
          : [TipoMissao.RESPONDER_QUESTOES],
        agora,
      )
    : [];
}

export async function contabilizarQuiz(
  tx: Tx,
  usuarioId: string,
  tema: string | null,
  dificuldade: Dificuldade | null,
  agora: Date,
) {
  const periodo = await obterPeriodo(tx, usuarioId, agora);
  if (!periodo) return [];
  // Filtros ausentes formam uma combinação própria; tema é comparado sem diferença de caixa.
  const chave = JSON.stringify([tema?.trim().toLocaleLowerCase("pt-BR") ?? null, dificuldade]);
  const evento = await tx.eventoMissao.createMany({
    data: [{ periodoId: periodo.id, tipo: "QUIZ", chave }],
    skipDuplicates: true,
  });
  return evento.count
    ? avancar(tx, periodo.id, usuarioId, [TipoMissao.CONCLUIR_QUIZZES], agora)
    : [];
}

export async function listarMissoes(usuarioId: string) {
  return prisma.$transaction(async (tx) => {
    await bloquearMissoes(tx, usuarioId);
    const agora = new Date();
    const intervalo = periodoDiario(agora);
    const periodo = await obterPeriodo(tx, usuarioId, agora);
    const itens = periodo
      ? await tx.missaoUsuario.findMany({
          where: { periodoId: periodo.id },
          include: { missao: true },
          orderBy: { missao: { codigo: "asc" } },
        })
      : [];
    const missoes = itens.map(({ id, progresso, concluidaEm, missao }) => ({
      id,
      codigo: missao.codigo,
      nome: missao.nome,
      descricao: missao.descricao,
      tipo: missao.tipo,
      meta: missao.meta,
      progresso,
      recompensaXp: missao.recompensaXp,
      status: concluidaEm ? "CONCLUIDA" : "EM_ANDAMENTO",
      concluidaEm,
    }));
    return {
      periodo: intervalo,
      missoes,
      resumo: {
        concluidas: missoes.filter((m) => m.status === "CONCLUIDA").length,
        total: missoes.length,
        xpGanhoHoje: missoes.reduce((s, m) => s + (m.concluidaEm ? m.recompensaXp : 0), 0),
      },
    };
  });
}
