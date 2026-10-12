import type { Dificuldade } from "@prisma/client";

import { XP_BASE_POR_QUESTAO, XP_BONUS_POR_ACERTO, XP_POR_NIVEL } from "./progressao.constants";
import type { ProgressoNivelDto, RecompensaXpDto } from "./progressao.types";

// Regras puras da progressao (sem banco): calculo da recompensa de uma rodada e
// conversao de XP acumulado em nivel. Ficam isoladas para serem faceis de testar.

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
 * Monta o retrato da progressao do usuario: nivel, quanto ja andou dentro do
 * nivel atual e quanto falta para o proximo (dados da barra de progresso).
 *
 * @param xpTotal XP acumulado do usuario.
 * @returns Nivel atual e progresso ate o proximo nivel.
 */
export function montarProgressoNivel(xpTotal: number): ProgressoNivelDto {
  const xp = Math.max(0, Math.floor(xpTotal));
  const nivel = calcularNivel(xp);
  const inicioDoNivel = xpAcumuladoParaNivel(nivel);
  const inicioDoProximo = xpAcumuladoParaNivel(nivel + 1);
  const xpNecessarioNoNivel = inicioDoProximo - inicioDoNivel;
  const xpNoNivel = xp - inicioDoNivel;

  return {
    xpTotal: xp,
    nivel,
    proximoNivel: nivel + 1,
    xpNoNivel,
    xpNecessarioNoNivel,
    xpFaltante: inicioDoProximo - xp,
    percentual: Math.floor((xpNoNivel / xpNecessarioNoNivel) * 100),
  };
}
