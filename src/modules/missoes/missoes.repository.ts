import { randomInt } from "node:crypto";
import { OrigemXp, PeriodicidadeMissao, TipoMissao, type Dificuldade, type Prisma } from "@prisma/client";
import { prisma } from "@/config/db";
import { creditarXp } from "@/modules/progressao/elo.repository";
import { periodoDiario, periodoSemanal } from "./periodo";

type Tx = Prisma.TransactionClient;

// Serializa atribuição e eventos do mesmo aluno, inclusive entre instâncias do serviço.
export async function bloquearMissoes(tx: Tx, usuarioId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${usuarioId}, 84))`;
}

function intervaloDaPeriodicidade(agora: Date, periodicidade: PeriodicidadeMissao) {
  return periodicidade === PeriodicidadeMissao.SEMANAL ? periodoSemanal(agora) : periodoDiario(agora);
}

async function obterPeriodo(
  tx: Tx,
  usuarioId: string,
  agora: Date,
  periodicidade: PeriodicidadeMissao,
) {
  const { inicio, fim } = intervaloDaPeriodicidade(agora, periodicidade);
  let periodo = await tx.periodoMissoes.findUnique({
    where: { usuarioId_periodicidade_inicio: { usuarioId, periodicidade, inicio } },
  });
  if (periodo) return periodo;
  const catalogo = await tx.missaoCatalogo.findMany({
    where: { ativa: true, periodicidade },
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
      periodicidade,
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
      // Mesmo caminho de credito da conclusao de rodada, para que o XP de elo e o
      // XP total nunca divirjam (US #89). Passa atividadeValida = false: concluir uma
      // missao (que pode disparar ao responder uma questao solta) nao e a "atividade
      // valida" da US, so a conclusao de um quiz reinicia a contagem de inatividade.
      const saldo = await creditarXp(tx, usuarioId, item.missao.recompensaXp, agora, false);
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
          xpEloApos: saldo.xpElo,
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
  const concluidas = [];
  for (const periodicidade of [PeriodicidadeMissao.DIARIA, PeriodicidadeMissao.SEMANAL]) {
    const periodo = await obterPeriodo(tx, usuarioId, agora, periodicidade);
    if (!periodo) continue;
    const evento = await tx.eventoMissao.createMany({
      data: [{ periodoId: periodo.id, tipo: "RESPOSTA", chave: questaoId }],
      skipDuplicates: true,
    });
    if (evento.count) concluidas.push(...await avancar(
      tx,
      periodo.id,
      usuarioId,
      correta
        ? [TipoMissao.RESPONDER_QUESTOES, TipoMissao.ACERTAR_QUESTOES]
        : [TipoMissao.RESPONDER_QUESTOES],
      agora,
    ));
  }
  return concluidas;
}

export async function contabilizarQuiz(
  tx: Tx,
  usuarioId: string,
  tema: string | null,
  dificuldade: Dificuldade | null,
  agora: Date,
) {
  // Filtros ausentes formam uma combinação própria; tema é comparado sem diferença de caixa.
  const chave = JSON.stringify([tema?.trim().toLocaleLowerCase("pt-BR") ?? null, dificuldade]);
  const concluidas = [];
  for (const periodicidade of [PeriodicidadeMissao.DIARIA, PeriodicidadeMissao.SEMANAL]) {
    const periodo = await obterPeriodo(tx, usuarioId, agora, periodicidade);
    if (!periodo) continue;
    const evento = await tx.eventoMissao.createMany({
      data: [{ periodoId: periodo.id, tipo: "QUIZ", chave }],
      skipDuplicates: true,
    });
    if (evento.count) concluidas.push(...await avancar(tx, periodo.id, usuarioId, [TipoMissao.CONCLUIR_QUIZZES], agora));
  }
  return concluidas;
}

export async function listarMissoes(
  usuarioId: string,
  periodicidade: PeriodicidadeMissao = PeriodicidadeMissao.DIARIA,
) {
  return prisma.$transaction(async (tx) => {
    await bloquearMissoes(tx, usuarioId);
    const agora = new Date();
    const intervalo = intervaloDaPeriodicidade(agora, periodicidade);
    const periodo = await obterPeriodo(tx, usuarioId, agora, periodicidade);
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
    const xpGanhoNoPeriodo = missoes.reduce((s, m) => s + (m.concluidaEm ? m.recompensaXp : 0), 0);
    return {
      periodo: intervalo,
      periodicidade,
      missoes,
      resumo: {
        concluidas: missoes.filter((m) => m.status === "CONCLUIDA").length,
        total: missoes.length,
        xpGanhoHoje: periodicidade === PeriodicidadeMissao.DIARIA ? xpGanhoNoPeriodo : 0,
        xpGanhoNoPeriodo,
      },
    };
  });
}
