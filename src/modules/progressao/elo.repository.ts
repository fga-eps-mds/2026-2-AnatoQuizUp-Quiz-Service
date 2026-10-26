import { EloXp, EstadoElo, TipoEventoElo, TipoNotificacaoElo, type Prisma } from "@prisma/client";

import { prisma } from "@/config/db";
import type { ParametrosPaginacao } from "@/shared/utils/paginacao.util";

import {
  CONFIGURACAO_INATIVIDADE_PADRAO,
  calcularDiasInatividade,
  calcularEstadoElo,
  calcularPrazoRebaixamento,
  montarNotificacaoRecuperacao,
  planejarEloAposAtividade,
  planejarInatividade,
} from "./inatividade.regras";
import type {
  ConfiguracaoInatividade,
  DadosProgressoElo,
  EstadoProgressoElo,
  JanelaIndisponibilidade,
  NotificacaoPlanejada,
  RetratoInatividade,
} from "./progressao.types";

// Persistencia do elo: credito de XP (que move os dois saldos e pode recuperar um elo)
// e a rotina de inatividade (que rebaixa, registra historico e enfileira avisos).
// Vive num arquivo proprio porque o modulo de missoes tambem credita XP e nao pode
// depender do progressao.repository (que, por sua vez, depende das missoes).

type Tx = Prisma.TransactionClient;

const SELECT_ESTADO = {
  xpTotal: true,
  xpElo: true,
  eloAtual: true,
  maiorElo: true,
  ultimaAtividadeEm: true,
  rebaixamentosAplicados: true,
} as const;

// Teto de estudantes avaliados por chamada da rotina, para a requisicao nao estourar o
// timeout do BFF. O agendador repete a chamada enquanto a resposta vier com pendentes.
const LIMITE_VARREDURA = 500;

const ESTADO_INICIAL: DadosProgressoElo & EstadoProgressoElo = {
  xpTotal: 0,
  xpElo: 0,
  eloAtual: EloXp.CURIOSO,
  maiorElo: EloXp.CURIOSO,
  ultimaAtividadeEm: null,
  rebaixamentosAplicados: 0,
};

/**
 * Serializa, por estudante, o credito de XP e a rotina de inatividade — inclusive entre
 * instancias do servico. Usa o mesmo espaco de lock da contabilizacao de missoes
 * (`bloquearMissoes`, em src/modules/missoes/missoes.repository.ts), para que concluir um
 * quiz e rebaixar o elo nunca aconteçam ao mesmo tempo.
 */
export async function bloquearProgresso(tx: Tx, usuarioId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${usuarioId}, 84))`;
}

type ResultadoCreditoXp = DadosProgressoElo & {
  eventoElo: TipoEventoElo | null;
  eloAnterior: EloXp;
};

// Avisos que antecedem a perda do elo. Deixam de valer no instante em que o estudante
// volta a concluir um quiz, entao sao marcados como lidos para nao reaparecerem.
const AVISOS_PRE_REBAIXAMENTO = [
  TipoNotificacaoElo.AVISO_PREVENTIVO,
  TipoNotificacaoElo.ELO_EM_RISCO,
  TipoNotificacaoElo.VESPERA_REBAIXAMENTO,
];

/**
 * Credita XP ao estudante.
 *
 * Unico caminho de entrada de XP no sistema (conclusao de rodada e missao concluida),
 * para que o XP total e o XP de elo nunca divirjam. Promove ou recupera o elo quando o
 * XP de elo alcanca a faixa seguinte.
 *
 * `atividadeValida` separa as duas origens: pela US #89, so a conclusao de um quiz que
 * concede XP reinicia a contagem de inatividade. Missoes tambem somam XP (senao os dois
 * saldos divergiriam), mas concluir uma missao respondendo uma questao solta nao deve
 * zerar o relogio da inatividade.
 *
 * O chamador deve estar dentro da transacao que ja detem o lock do estudante.
 *
 * @param tx Transacao Prisma em curso.
 * @param usuarioId Dono do XP.
 * @param quantidade XP concedido (sempre positivo).
 * @param agora Momento da atividade.
 * @param atividadeValida Se este credito reinicia a contagem de inatividade.
 * @returns Saldos e elos apos o credito, e o evento de elo gerado (se houve).
 */
export async function creditarXp(
  tx: Tx,
  usuarioId: string,
  quantidade: number,
  agora: Date,
  atividadeValida = true,
): Promise<ResultadoCreditoXp> {
  const anterior = await tx.progressoXp.findUnique({
    where: { usuarioId },
    select: { eloAtual: true, maiorElo: true },
  });

  const eloAnterior = anterior?.eloAtual ?? EloXp.CURIOSO;
  const maiorEloAnterior = anterior?.maiorElo ?? EloXp.CURIOSO;

  const saldo = await tx.progressoXp.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      xpTotal: quantidade,
      xpElo: quantidade,
      ...(atividadeValida && { ultimaAtividadeEm: agora }),
    },
    update: {
      xpTotal: { increment: quantidade },
      xpElo: { increment: quantidade },
      // Atividade valida reinicia a contagem de inatividade.
      ...(atividadeValida && { ultimaAtividadeEm: agora, rebaixamentosAplicados: 0 }),
    },
    select: { xpTotal: true, xpElo: true },
  });

  // O ciclo de inatividade acabou: os avisos que falavam de um rebaixamento futuro
  // nao valem mais e nao devem aparecer no proximo login.
  if (atividadeValida) {
    await tx.notificacaoElo.updateMany({
      where: { usuarioId, lidaEm: null, tipo: { in: AVISOS_PRE_REBAIXAMENTO } },
      data: { lidaEm: agora },
    });
  }

  const plano = planejarEloAposAtividade(saldo.xpElo, eloAnterior, maiorEloAnterior);

  if (!plano.evento) {
    return {
      xpTotal: saldo.xpTotal,
      xpElo: saldo.xpElo,
      eloAtual: eloAnterior,
      maiorElo: maiorEloAnterior,
      eventoElo: null,
      eloAnterior,
    };
  }

  await tx.progressoXp.update({
    where: { usuarioId },
    data: { eloAtual: plano.elo.codigo, maiorElo: plano.maiorElo.codigo },
  });

  const evento = await tx.eventoElo.create({
    data: {
      usuarioId,
      tipo: plano.evento,
      eloAnterior,
      eloNovo: plano.elo.codigo,
      xpEloAntes: Math.max(0, saldo.xpElo - quantidade),
      xpEloDepois: saldo.xpElo,
    },
    select: { id: true },
  });

  // A US pede aviso apenas na recuperacao; a promocao inedita ja e celebrada na tela
  // de resultado do quiz (subiuDeElo).
  if (plano.evento === TipoEventoElo.RECUPERACAO) {
    await gravarNotificacoes(tx, usuarioId, [montarNotificacaoRecuperacao(plano.elo, evento.id)]);
  }

  return {
    xpTotal: saldo.xpTotal,
    xpElo: saldo.xpElo,
    eloAtual: plano.elo.codigo,
    maiorElo: plano.maiorElo.codigo,
    eventoElo: plano.evento,
    eloAnterior,
  };
}

// Grava avisos ignorando os que já existem no ciclo (unique [usuarioId, tipo, chave]).
async function gravarNotificacoes(
  tx: Tx,
  usuarioId: string,
  notificacoes: readonly NotificacaoPlanejada[],
): Promise<number> {
  if (notificacoes.length === 0) {
    return 0;
  }

  const { count } = await tx.notificacaoElo.createMany({
    data: notificacoes.map((notificacao) => ({ usuarioId, ...notificacao })),
    skipDuplicates: true,
  });

  return count;
}

export type ResultadoInatividade = {
  dados: DadosProgressoElo;
  retrato: RetratoInatividade;
  rebaixamentos: number;
  notificacoes: number;
};

/**
 * Avalia a inatividade de um estudante e aplica o que estiver pendente: rebaixamentos em
 * cascata, ajuste do XP de elo, historico e avisos.
 *
 * Idempotente: `rebaixamentosAplicados` guarda quantas quedas o ciclo atual ja sofreu,
 * entao reexecutar a rotina no mesmo dia nao rebaixa de novo. O XP total e o maior elo
 * jamais sao alterados aqui.
 *
 * @param usuarioId Estudante avaliado.
 * @param agora Momento de referencia (injetavel nos testes).
 * @param config Prazos configurados (padrao: linha de configuracao do banco).
 * @returns Estado apos a avaliacao, para montar a resposta de progresso.
 */
export async function aplicarInatividade(
  usuarioId: string,
  agora: Date = new Date(),
  config?: ConfiguracaoInatividade,
): Promise<ResultadoInatividade> {
  const prazos = config ?? (await buscarConfiguracao());

  return await prisma.$transaction(async (tx) => {
    await bloquearProgresso(tx, usuarioId);

    const progresso = await tx.progressoXp.findUnique({
      where: { usuarioId },
      select: SELECT_ESTADO,
    });

    if (!progresso) {
      return {
        dados: ESTADO_INICIAL,
        retrato: {
          estado: EstadoElo.ATIVO,
          diasInatividade: 0,
          diasParaAviso: prazos.diasAviso,
          ultimaAtividadeEm: null,
          prazoRebaixamentoEm: null,
        },
        rebaixamentos: 0,
        notificacoes: 0,
      };
    }

    const plano = planejarInatividade(progresso, agora, prazos);

    if (plano.houveMudanca) {
      await tx.progressoXp.update({
        where: { usuarioId },
        data: {
          eloAtual: plano.eloFinal.codigo,
          xpElo: plano.xpEloFinal,
          rebaixamentosAplicados: plano.rebaixamentosAplicados,
        },
      });

      if (plano.rebaixamentos.length > 0) {
        await tx.eventoElo.createMany({
          data: plano.rebaixamentos.map((rebaixamento) => ({
            usuarioId,
            tipo: TipoEventoElo.REBAIXAMENTO,
            ...rebaixamento,
          })),
        });
      }
    }

    const notificacoes = await gravarNotificacoes(tx, usuarioId, plano.notificacoes);

    return {
      dados: {
        xpTotal: progresso.xpTotal,
        xpElo: plano.xpEloFinal,
        eloAtual: plano.eloFinal.codigo,
        maiorElo: progresso.maiorElo,
      },
      retrato: {
        estado: plano.estado,
        diasInatividade: plano.diasInatividade,
        diasParaAviso: prazos.diasAviso,
        ultimaAtividadeEm: progresso.ultimaAtividadeEm,
        prazoRebaixamentoEm: plano.prazoRebaixamentoEm,
      },
      rebaixamentos: plano.rebaixamentos.length,
      notificacoes,
    };
  });
}

/**
 * Varredura em lote da inatividade, chamada pela rotina autorizada.
 *
 * So considera quem ja pode ter algo a receber (inativo a partir do primeiro aviso), e
 * avalia cada estudante pela propria chave — nunca por um identificador vindo da
 * requisicao.
 *
 * Processa um estudante por transacao, em lotes de no maximo `limite` por chamada, para
 * caber no timeout da requisicao: se sobrar gente, a resposta devolve `pendentes: true` e
 * o agendador simplesmente chama de novo. Como a avaliacao e idempotente, repetir a
 * chamada e sempre seguro.
 *
 * @param agora Momento de referencia.
 * @param limite Maximo de estudantes avaliados nesta chamada.
 * @returns Totais avaliados, rebaixados, notificados e se ainda ha candidatos.
 */
export async function aplicarInatividadeEmLote(
  agora: Date = new Date(),
  limite = LIMITE_VARREDURA,
): Promise<{
  avaliados: number;
  rebaixamentos: number;
  notificacoes: number;
  pendentes: boolean;
}> {
  const config = await buscarConfiguracao();

  const corte = new Date(agora.getTime() - config.diasAviso * 24 * 60 * 60 * 1000);
  const where = { ultimaAtividadeEm: { not: null, lte: corte } } as const;

  const candidatos = await prisma.progressoXp.findMany({
    where,
    select: { usuarioId: true },
    orderBy: { ultimaAtividadeEm: "asc" },
    take: limite,
  });

  let rebaixamentos = 0;
  let notificacoes = 0;

  for (const candidato of candidatos) {
    const resultado = await aplicarInatividade(candidato.usuarioId, agora, config);
    rebaixamentos += resultado.rebaixamentos;
    notificacoes += resultado.notificacoes;
  }

  return {
    avaliados: candidatos.length,
    rebaixamentos,
    notificacoes,
    pendentes: candidatos.length === limite,
  };
}

/**
 * Estado de inatividade sem aplicar nada (leitura pura, para telas que so exibem).
 *
 * @param progresso Estado persistido.
 * @param agora Momento de referencia.
 * @param config Prazos configurados.
 * @returns Retrato de inatividade.
 */
export function montarRetratoInatividade(
  progresso: EstadoProgressoElo,
  agora: Date,
  config: ConfiguracaoInatividade,
): RetratoInatividade {
  const diasInatividade = calcularDiasInatividade(
    progresso.ultimaAtividadeEm,
    agora,
    config.indisponibilidades,
  );

  return {
    estado: calcularEstadoElo(diasInatividade, config),
    diasInatividade,
    diasParaAviso: config.diasAviso,
    ultimaAtividadeEm: progresso.ultimaAtividadeEm,
    prazoRebaixamentoEm: calcularPrazoRebaixamento(
      progresso.ultimaAtividadeEm,
      progresso.rebaixamentosAplicados,
      config,
      agora,
    ),
  };
}

// Converte o JSON de indisponibilidades do banco em janelas validas, descartando
// entradas malformadas em vez de derrubar a leitura da configuracao.
function normalizarIndisponibilidades(valor: unknown): JanelaIndisponibilidade[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const { inicio, fim } = item as { inicio?: unknown; fim?: unknown };

    if (typeof inicio !== "string" || typeof fim !== "string") {
      return [];
    }

    const janela = { inicio: new Date(inicio), fim: new Date(fim) };

    return Number.isNaN(janela.inicio.getTime()) ||
      Number.isNaN(janela.fim.getTime()) ||
      janela.fim <= janela.inicio
      ? []
      : [janela];
  });
}

/**
 * Prazos vigentes da regra de inatividade.
 *
 * Somente leitura: enquanto o administrador nao gravar nada, valem os padroes da US sem
 * criar linha nenhuma. Isso importa porque esta funcao esta no caminho de toda consulta
 * de progresso — um upsert aqui tomaria lock de escrita na mesma linha a cada leitura.
 *
 * @returns Configuracao vigente.
 */
export async function buscarConfiguracao(): Promise<ConfiguracaoInatividade> {
  const linha = await prisma.configuracaoInatividade.findUnique({ where: { id: "global" } });

  if (!linha) {
    return CONFIGURACAO_INATIVIDADE_PADRAO;
  }

  return {
    diasAviso: linha.diasAviso,
    diasRisco: linha.diasRisco,
    diasRebaixamento: linha.diasRebaixamento,
    diasEntreRebaixamentos: linha.diasEntreRebaixamentos,
    indisponibilidades: normalizarIndisponibilidades(linha.indisponibilidades),
  };
}

/**
 * Linha completa de configuracao, para a resposta da API administrativa.
 *
 * Sem linha gravada, devolve os padroes da US com `atualizadoPorId` nulo — assim o
 * `atualizadoEm` exibido continua sendo a data da ultima alteracao real.
 */
export async function buscarConfiguracaoCompleta() {
  const linha = await prisma.configuracaoInatividade.findUnique({ where: { id: "global" } });

  return (
    linha ?? {
      id: "global",
      ...CONFIGURACAO_INATIVIDADE_PADRAO,
      indisponibilidades: [] as unknown,
      atualizadoPorId: null,
      atualizadoEm: null,
    }
  );
}

/**
 * Grava novos prazos de inatividade. Restrito ao papel administrativo pela rota.
 *
 * @param dados Prazos e janelas de indisponibilidade.
 * @param atualizadoPorId Administrador responsavel pela alteracao.
 * @returns Linha de configuracao atualizada.
 */
export async function salvarConfiguracao(
  dados: {
    diasAviso: number;
    diasRisco: number;
    diasRebaixamento: number;
    diasEntreRebaixamentos: number;
    indisponibilidades: { inicio: string; fim: string }[];
  },
  atualizadoPorId: string,
) {
  return await prisma.configuracaoInatividade.upsert({
    where: { id: "global" },
    create: { ...dados, atualizadoPorId },
    update: { ...dados, atualizadoPorId },
  });
}

/**
 * Historico paginado de progressao de elo do estudante, mais recente primeiro.
 *
 * @param usuarioId Dono do historico.
 * @param paginacao Parametros de paginacao.
 * @returns Pagina de eventos e o total.
 */
export async function listarHistoricoElo(usuarioId: string, paginacao: ParametrosPaginacao) {
  const where = { usuarioId };

  const [data, total] = await prisma.$transaction([
    prisma.eventoElo.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: paginacao.skip,
      take: paginacao.limit,
    }),
    prisma.eventoElo.count({ where }),
  ]);

  return { data, total };
}

/**
 * Avisos do estudante, mais recentes primeiro.
 *
 * @param usuarioId Destinatario (sempre o usuario autenticado).
 * @param apenasNaoLidas Filtra os avisos ainda nao lidos.
 * @returns Lista de notificacoes.
 */
export async function listarNotificacoes(usuarioId: string, apenasNaoLidas = false) {
  return await prisma.notificacaoElo.findMany({
    where: { usuarioId, ...(apenasNaoLidas && { lidaEm: null }) },
    orderBy: { criadoEm: "desc" },
  });
}

/**
 * Marca um aviso como lido.
 *
 * O id e o usuario andam juntos no filtro: um estudante nunca consegue marcar (nem
 * descobrir) a notificacao de outro.
 *
 * @param id Id da notificacao.
 * @param usuarioId Destinatario esperado.
 * @returns true se a notificacao era do usuario e foi marcada.
 */
export async function marcarNotificacaoLida(id: string, usuarioId: string): Promise<boolean> {
  const { count } = await prisma.notificacaoElo.updateMany({
    where: { id, usuarioId, lidaEm: null },
    data: { lidaEm: new Date() },
  });

  if (count > 0) {
    return true;
  }

  // Ja estava lida: tratamos como sucesso para a chamada ser idempotente.
  const existe = await prisma.notificacaoElo.count({ where: { id, usuarioId } });

  return existe > 0;
}

export { CONFIGURACAO_INATIVIDADE_PADRAO };
