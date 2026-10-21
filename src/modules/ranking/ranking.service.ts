import { calcularNivel, resolverFaixaElo } from '../progressao/progressao.regras';

import type { RankingRepository } from './ranking.repository';
import type { PontuacaoUsuario } from './ranking.types';

/**
 * Ordena pelo XP acumulado (US de progressão): mais XP primeiro. Os critérios
 * anteriores viram desempate: mais acertos; depois quem respondeu menos
 * questões (mais eficiente); e, persistindo o empate, quem atingiu a pontuação
 * primeiro (atividade mais antiga).
 */
export function compararPontuacoes(a: PontuacaoUsuario, b: PontuacaoUsuario): number {
  if (b.xpTotal !== a.xpTotal) {
    return b.xpTotal - a.xpTotal;
  }

  if (b.totalAcertos !== a.totalAcertos) {
    return b.totalAcertos - a.totalAcertos;
  }

  if (a.totalRespondidas !== b.totalRespondidas) {
    return a.totalRespondidas - b.totalRespondidas;
  }

  const dataA = a.ultimaAtividade ? new Date(a.ultimaAtividade).getTime() : Number.POSITIVE_INFINITY;
  const dataB = b.ultimaAtividade ? new Date(b.ultimaAtividade).getTime() : Number.POSITIVE_INFINITY;

  return dataA - dataB;
}

export class RankingService {
  constructor(private readonly repository: RankingRepository) {}

  async obterPontuacoes(usuarioIds?: string[]): Promise<PontuacaoUsuario[]> {
    const linhas = await this.repository.agregarPontuacoes(usuarioIds);

    const pontuacoes: PontuacaoUsuario[] = linhas.map((linha) => {
      const xpTotal = Number(linha.xpTotal ?? 0);
      const faixaElo = resolverFaixaElo(xpTotal, linha.maiorElo);

      return {
        usuarioId: linha.usuarioId,
        xpTotal,
        nivel: calcularNivel(xpTotal),
        elo: faixaElo.nome,
        totalAcertos: Number(linha.acertos),
        totalRespondidas: Number(linha.respondidas),
        ultimaAtividade: linha.ultimaAtividade ? linha.ultimaAtividade.toISOString() : null,
      };
    });

    pontuacoes.sort(compararPontuacoes);

    return pontuacoes;
  }
}
