import type { Dificuldade, EloXp } from "@prisma/client";

import {
  FAIXAS_ELO,
  XP_BASE_POR_QUESTAO,
  XP_BONUS_POR_ACERTO,
  XP_POR_NIVEL,
} from "./progressao.constants";
import type {
  DadosProgressoElo,
  EloJornadaDto,
  FaixaEloDto,
  ProgressoNivelDto,
  RecompensaXpDto,
  RetratoInatividade,
  StatusFaixaElo,
} from "./progressao.types";

// Regras puras da progressao (sem banco): calculo da recompensa de uma rodada,
// conversao de XP acumulado em nivel e determinacao do elo atual/proximo elo.
// Ficam isoladas para serem faceis de testar.

/**
 * Calcula o XP de uma rodada concluida.
 *
 * - XP base: proporcional ao numero de questoes da rodada (premia a conclusao).
 * - Bonus de desempenho: soma do bonus de cada acerto, conforme a dificuldade.
 * - Bonus de power-up: reservado para itens da loja que venham a multiplicar XP.
 *
 * @param totalQuestoes Quantidade de questoes da rodada.
 * @param dificuldadesDosAcertos Dificuldade de cada questao acertada.
 * @param bonusPowerUp XP extra vindo de potencializador ativo (0 se nao houver).
 * @returns Detalhamento da recompensa.
 */
export function calcularRecompensaXp(
  totalQuestoes: number,
  dificuldadesDosAcertos: Dificuldade[],
  bonusPowerUp = 0,
): RecompensaXpDto {
  const xpBase = Math.max(0, totalQuestoes) * XP_BASE_POR_QUESTAO;
  const bonusDesempenho = dificuldadesDosAcertos.reduce(
    (soma, dificuldade) => soma + XP_BONUS_POR_ACERTO[dificuldade],
    0,
  );
  const bonus = Math.max(0, bonusPowerUp);

  return {
    xpBase,
    bonusDesempenho,
    bonusPowerUp: bonus,
    xpTotalRecebido: xpBase + bonusDesempenho + bonus,
  };
}

/**
 * XP acumulado necessario para ALCANCAR um nivel.
 *
 * Como cada nivel N custa XP_POR_NIVEL * N para ser superado, o acumulado ate
 * o nivel N e a soma de 1..N-1 vezes XP_POR_NIVEL.
 *
 * @param nivel Nivel alvo (1 = inicial).
 * @returns XP total minimo para estar nesse nivel.
 */
export function xpAcumuladoParaNivel(nivel: number): number {
  const n = Math.max(1, Math.floor(nivel));
  return (XP_POR_NIVEL * n * (n - 1)) / 2;
}

/**
 * Converte XP acumulado no nivel correspondente.
 *
 * @param xpTotal XP acumulado do usuario.
 * @returns Nivel atual (minimo 1).
 */
export function calcularNivel(xpTotal: number): number {
  const xp = Math.max(0, Math.floor(xpTotal));
  let nivel = 1;

  while (xpAcumuladoParaNivel(nivel + 1) <= xp) {
    nivel += 1;
  }

  return nivel;
}

/**
 * Busca a definicao de uma faixa de elo pelo codigo.
 *
 * @param codigo Codigo do elo (EloXp).
 * @param faixas Lista de faixas configuradas (padrao: FAIXAS_ELO).
 * @returns A faixa correspondente (ou a primeira faixa como fallback seguro).
 */
export function obterFaixaEloPorCodigo(
  codigo: EloXp,
  faixas: readonly FaixaEloDto[] = FAIXAS_ELO,
): FaixaEloDto {
  return faixas.find((faixa) => faixa.codigo === codigo) ?? faixas[0];
}

/**
 * Calcula a faixa de elo puramente pelo XP total acumulado.
 *
 * @param xpTotal XP acumulado do estudante.
 * @param faixas Lista de faixas configuradas em ordem crescente.
 * @returns Faixa de elo correspondente ao XP.
 */
export function calcularFaixaEloPorXp(
  xpTotal: number,
  faixas: readonly FaixaEloDto[] = FAIXAS_ELO,
): FaixaEloDto {
  const xp = Math.max(0, Math.floor(xpTotal));
  let faixaEncontrada = faixas[0];

  for (const faixa of faixas) {
    if (xp >= faixa.xpMinimo) {
      faixaEncontrada = faixa;
    } else {
      break;
    }
  }

  return faixaEncontrada;
}

/**
 * Calcula o status de uma faixa especifica na tela "Todos os elos".
 */
function calcularStatusFaixaJornada(
  faixa: FaixaEloDto,
  eloAtual: FaixaEloDto,
  proximoElo: FaixaEloDto | null,
  totalFaixas: number,
  maiorElo: FaixaEloDto,
): StatusFaixaElo {
  if (faixa.ordem < eloAtual.ordem) {
    return "CONQUISTADO";
  }
  if (faixa.ordem === eloAtual.ordem) {
    return "ELO_ATUAL";
  }
  if (proximoElo && faixa.ordem === proximoElo.ordem) {
    return "PROXIMO_ELO";
  }
  // Faixa acima do elo atual mas dentro do recorde: o estudante ja passou por ela e
  // perdeu por inatividade, entao continua conquistada (nao "bloqueada").
  if (faixa.ordem <= maiorElo.ordem) {
    return "CONQUISTADO";
  }
  if (faixa.ordem === totalFaixas) {
    return "ELO_MAXIMO";
  }
  return "BLOQUEADO";
}

/**
 * Monta a lista completa das faixas de elo com o progresso do estudante em cada uma.
 *
 * `maiorElo` entra no calculo porque, depois de um rebaixamento, as faixas acima do elo
 * atual mas dentro do recorde seguem conquistadas — e a mesma garantia que a tela
 * "Maior elo (conquista preservada)" anuncia.
 *
 * @param xpElo XP de elo do estudante (base das faixas).
 * @param eloAtual Faixa de elo atual do estudante.
 * @param proximoElo Proxima faixa de elo (ou null se estiver no ultimo elo).
 * @param percentualNoEloAtual Percentual de avanco dentro da faixa atual (0 a 100).
 * @param faixas Lista de faixas configuradas.
 * @param maiorElo Maior faixa ja conquistada (padrao: o proprio elo atual).
 * @returns Lista ordenada de todas as faixas para a jornada de elos.
 */
export function montarJornadaElos(
  xpElo: number,
  eloAtual: FaixaEloDto,
  proximoElo: FaixaEloDto | null,
  percentualNoEloAtual: number,
  faixas: readonly FaixaEloDto[] = FAIXAS_ELO,
  maiorElo: FaixaEloDto = eloAtual,
): EloJornadaDto[] {
  const xp = Math.max(0, Math.floor(xpElo));

  return faixas.map((faixa, index) => {
    const status = calcularStatusFaixaJornada(faixa, eloAtual, proximoElo, faixas.length, maiorElo);
    const conquistado = faixa.ordem < eloAtual.ordem || faixa.ordem <= maiorElo.ordem;
    const ehAtual = faixa.ordem === eloAtual.ordem;
    const eloAnterior = index > 0 ? faixas[index - 1] : null;

    let percentual = 0;
    if (ehAtual) {
      percentual = percentualNoEloAtual;
    } else if (conquistado) {
      percentual = 100;
    }

    const xpFaltante = faixa.ordem <= eloAtual.ordem ? 0 : Math.max(0, faixa.xpMinimo - xp);

    return {
      ...faixa,
      status,
      conquistado,
      ehAtual,
      percentual,
      xpFaltante,
      eloAnteriorNome: eloAnterior ? eloAnterior.nome : null,
    };
  });
}

/**
 * Monta o retrato completo da progressao do usuario: nivel (pelo XP total), elo atual
 * e maior elo (pelo estado persistido), proximo elo, XP faltante, todas as faixas da
 * jornada e o estado de inatividade.
 *
 * Desde a US #89 o elo nao e mais derivado do XP total: ele vive em `eloAtual`, pode cair
 * por inatividade e tem o proprio saldo (`xpElo`). `maiorElo` e so o recorde preservado.
 *
 * @param dados XP total, XP de elo, elo atual e maior elo conquistado.
 * @param inatividade Estado, contagem de dias e prazo para o proximo rebaixamento.
 * @param faixas Faixas configuradas (permite injecao em testes de alteracao de faixas).
 * @returns Dados completos de nivel, elo e inatividade.
 */
export function montarProgressoNivel(
  dados: DadosProgressoElo,
  inatividade: RetratoInatividade,
  faixas: readonly FaixaEloDto[] = FAIXAS_ELO,
): ProgressoNivelDto {
  const xp = Math.max(0, Math.floor(dados.xpTotal));
  const xpElo = Math.max(0, Math.floor(dados.xpElo));
  const nivel = calcularNivel(xp);
  const inicioDoNivel = xpAcumuladoParaNivel(nivel);
  const inicioDoProximo = xpAcumuladoParaNivel(nivel + 1);
  const xpNecessarioNoNivel = inicioDoProximo - inicioDoNivel;
  const xpNoNivel = xp - inicioDoNivel;

  const eloAtual = obterFaixaEloPorCodigo(dados.eloAtual, faixas);
  const maiorElo = obterFaixaEloPorCodigo(dados.maiorElo, faixas);
  const proximoElo = faixas.find((faixa) => faixa.ordem === eloAtual.ordem + 1) ?? null;

  let xpNoElo = Math.max(0, xpElo - eloAtual.xpMinimo);
  let xpNecessarioNoElo: number | null = null;
  let xpFaltanteProximoElo = 0;
  let percentualElo = 100;

  if (proximoElo) {
    xpNecessarioNoElo = proximoElo.xpMinimo - eloAtual.xpMinimo;
    xpFaltanteProximoElo = Math.max(0, proximoElo.xpMinimo - xpElo);
    xpNoElo = Math.max(0, Math.min(xpNecessarioNoElo, xpElo - eloAtual.xpMinimo));
    percentualElo =
      xpNecessarioNoElo > 0 ? Math.min(100, Math.round((xpNoElo / xpNecessarioNoElo) * 100)) : 100;
  }

  const todosOsElos = montarJornadaElos(
    xpElo,
    eloAtual,
    proximoElo,
    percentualElo,
    faixas,
    maiorElo,
  );

  return {
    xpTotal: xp,
    xpElo,
    nivel,
    proximoNivel: nivel + 1,
    xpNoNivel,
    xpNecessarioNoNivel,
    xpFaltante: inicioDoProximo - xp,
    percentual: Math.floor((xpNoNivel / xpNecessarioNoNivel) * 100),
    eloAtual,
    maiorElo,
    proximoElo,
    xpNoElo,
    xpNecessarioNoElo,
    xpFaltanteProximoElo,
    percentualElo,
    todosOsElos,
    estadoElo: inatividade.estado,
    diasInatividade: inatividade.diasInatividade,
    diasParaAviso: inatividade.diasParaAviso,
    ultimaAtividadeEm: inatividade.ultimaAtividadeEm
      ? inatividade.ultimaAtividadeEm.toISOString()
      : null,
    prazoRebaixamentoEm: inatividade.prazoRebaixamentoEm
      ? inatividade.prazoRebaixamentoEm.toISOString()
      : null,
  };
}
