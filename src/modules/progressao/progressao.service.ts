import { randomInt } from "node:crypto";

import { StatusTentativaQuiz } from "@prisma/client";

import { converterParaRespostaQuestaoQuiz } from "@/modules/quiz/dto/mappers/converter_para_resposta_questao_quiz";
import { MENSAGENS } from "@/shared/constants/mensagens";
import { PAPEIS, type Papel } from "@/shared/constants/papeis";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";
import type { RespostaPaginada } from "@/shared/types/api.types";
import {
  montarMetadadosPaginacao,
  resolverParametrosPaginacao,
} from "@/shared/utils/paginacao.util";

import { LIMITE_QUESTOES_POR_RODADA } from "./progressao.constants";
import {
  calcularFaixaEloPorXp,
  calcularNivel,
  calcularRecompensaXp,
  montarProgressoNivel,
} from "./progressao.regras";
import type { ProgressaoRepository, TentativaParaConclusao } from "./progressao.repository";
import type {
  HistoricoXpItemDto,
  HistoricoXpQueryDto,
  IniciarTentativaDto,
  ProgressoNivelDto,
  RecompensaXpDto,
  ResultadoTentativaDto,
  TentativaIniciadaDto,
} from "./progressao.types";

const RECOMPENSA_ZERADA: RecompensaXpDto = {
  xpBase: 0,
  bonusDesempenho: 0,
  bonusPowerUp: 0,
  xpTotalRecebido: 0,
};

/**
 * Service da progressao do aluno.
 *
 * Controla as rodadas de quiz (inicio e conclusao), concede XP ao concluir e
 * expoe o nivel atual, o elo atual e o historico de XP.
 */
export class ProgressaoService {
  constructor(private readonly repository: ProgressaoRepository) {}

  /**
   * Inicia uma rodada de quiz: sorteia ate LIMITE_QUESTOES_POR_RODADA questoes
   * entre as disponiveis para o filtro e grava a rodada com esse total.
   *
   * Se houver menos questoes que o limite, a rodada usa todas elas (ex.: tema
   * com 4 questoes gera uma rodada de 4).
   *
   * @param dto Tema e dificuldade escolhidos.
   * @param usuarioId Usuario autenticado.
   * @returns Id da rodada, total e as questoes na ordem de exibicao.
   * @throws ErroAplicacao 401 sem usuario; 404 se nao houver questoes.
   */
  async iniciarTentativa(
    dto: IniciarTentativaDto,
    usuarioId: string,
  ): Promise<TentativaIniciadaDto> {
    this.exigirUsuario(usuarioId);

    const idsDisponiveis = await this.repository.listarIdsQuestoesDisponiveis(dto);

    if (idsDisponiveis.length === 0) {
      throw new ErroAplicacao({
        codigoStatus: 404,
        codigo: CodigoDeErro.NAO_ENCONTRADO,
        mensagem: MENSAGENS.questaoNaoEncontrada,
      });
    }

    const idsSorteados = this.embaralhar(idsDisponiveis).slice(0, LIMITE_QUESTOES_POR_RODADA);
    const questoes = await this.repository.buscarQuestoesPorIds(idsSorteados);

    // Mantem a ordem sorteada (o banco nao garante a ordem do "in").
    const questoesPorId = new Map(questoes.map((questao) => [questao.id, questao]));
    const questoesOrdenadas = idsSorteados
      .map((id) => questoesPorId.get(id))
      .filter((questao) => questao !== undefined);

    const tentativa = await this.repository.criarTentativa(
      usuarioId,
      { tema: dto.tema ?? null, dificuldade: dto.dificuldade ?? null },
      questoesOrdenadas.map((questao) => questao.id),
    );

    return {
      tentativaId: tentativa.id,
      totalQuestoes: tentativa.totalQuestoes,
      questoes: questoesOrdenadas.map(converterParaRespostaQuestaoQuiz),
    };
  }

  /**
   * Conclui uma rodada e concede o XP correspondente.
   *
   * Os acertos sao contados no servidor, a partir das respostas gravadas na
   * rodada. A operacao e idempotente: repetir a chamada (refresh, clique duplo,
   * nova requisicao) devolve o mesmo resultado com jaConcluida = true e nao
   * credita XP novamente. So ALUNO recebe XP.
   *
   * @param tentativaId Id da rodada.
   * @param usuarioId Usuario autenticado.
   * @param papel Papel do usuario.
   * @returns Recompensa, XP acumulado, nivel/elo e se houve subida de nivel ou elo.
   * @throws ErroAplicacao 401 sem usuario; 404 rodada inexistente; 409 rodada incompleta.
   */
  async concluirTentativa(
    tentativaId: string,
    usuarioId: string,
    papel?: Papel,
  ): Promise<ResultadoTentativaDto> {
    this.exigirUsuario(usuarioId);

    const tentativa = await this.buscarTentativaOuFalhar(tentativaId, usuarioId);

    if (tentativa.status === StatusTentativaQuiz.CONCLUIDA) {
      return await this.montarResultado(tentativa, true);
    }

    if (tentativa.respostas.length < tentativa.totalQuestoes) {
      throw new ErroAplicacao({
        codigoStatus: 409,
        codigo: CodigoDeErro.CONFLITO,
        mensagem: MENSAGENS.tentativaIncompleta,
        detalhes: {
          respondidas: tentativa.respostas.length,
          totalQuestoes: tentativa.totalQuestoes,
        },
      });
    }

    const acertos = tentativa.respostas.filter(
      (resposta) => resposta.respostaMarcada === resposta.questao.respostaCorreta,
    );

    const recompensa =
      papel === PAPEIS.ALUNO
        ? calcularRecompensaXp(
            tentativa.totalQuestoes,
            acertos.map((resposta) => resposta.questao.dificuldade),
          )
        : null;

    const { concluidaAgora, missoesConcluidas } = await this.repository.concluirTentativa({
      tentativaId,
      usuarioId,
      totalAcertos: acertos.length,
      recompensa,
    });

    // Relemos a rodada: o resultado sai sempre do que ficou gravado, seja esta
    // a chamada que concluiu ou uma concorrente que chegou primeiro.
    const tentativaConcluida = await this.buscarTentativaOuFalhar(tentativaId, usuarioId);

    return {
      ...(await this.montarResultado(tentativaConcluida, !concluidaAgora)),
      missoesConcluidas: missoesConcluidas ?? [],
    };
  }

  /**
   * Nivel e elo atuais e progresso ate o proximo nivel/elo do usuario.
   *
   * @param usuarioId Usuario autenticado.
   * @returns XP acumulado, nivel, elo e XP faltante.
   */
  async buscarProgresso(usuarioId: string): Promise<ProgressoNivelDto> {
    this.exigirUsuario(usuarioId);

    const { xpTotal, maiorElo } = await this.repository.buscarDadosProgresso(usuarioId);

    return montarProgressoNivel(xpTotal, maiorElo);
  }

  /**
   * Historico paginado do XP recebido (data, origem, quiz relacionado e valor).
   *
   * @param usuarioId Usuario autenticado.
   * @param query Paginacao.
   * @returns Pagina do historico de XP.
   */
  async buscarHistoricoXp(
    usuarioId: string,
    query: HistoricoXpQueryDto,
  ): Promise<RespostaPaginada<HistoricoXpItemDto>> {
    this.exigirUsuario(usuarioId);

    const paginacao = resolverParametrosPaginacao(query);
    const { data, total } = await this.repository.listarHistoricoXp(usuarioId, paginacao);

    const dados: HistoricoXpItemDto[] = data.map((transacao) => ({
      id: transacao.id,
      data: transacao.criadoEm.toISOString(),
      origem: transacao.origem,
      missao: transacao.missaoUsuario?.missao ?? null,
      quiz: transacao.tentativa
        ? {
            tentativaId: transacao.tentativa.id,
            tema: transacao.tentativa.tema,
            dificuldade: transacao.tentativa.dificuldade,
            totalQuestoes: transacao.tentativa.totalQuestoes,
            totalAcertos: transacao.tentativa.totalAcertos ?? 0,
          }
        : null,
      xpBase: transacao.xpBase,
      bonusDesempenho: transacao.bonusDesempenho,
      bonusPowerUp: transacao.bonusPowerUp,
      valor: transacao.quantidade,
    }));

    return { dados, metadados: montarMetadadosPaginacao(paginacao, total) };
  }

  // Monta o resultado a partir do que esta gravado na rodada (base da idempotencia).
  private async montarResultado(
    tentativa: TentativaParaConclusao,
    jaConcluida: boolean,
  ): Promise<ResultadoTentativaDto> {
    const transacao = tentativa.transacaoXp;
    const { xpTotal: xpTotalAtual, maiorElo } = await this.repository.buscarDadosProgresso(
      tentativa.usuarioId,
    );

    const recompensa: RecompensaXpDto = transacao
      ? {
          xpBase: transacao.xpBase,
          bonusDesempenho: transacao.bonusDesempenho,
          bonusPowerUp: transacao.bonusPowerUp,
          xpTotalRecebido: transacao.quantidade,
        }
      : RECOMPENSA_ZERADA;

    // Nivel e elo antes/depois desta rodada, reconstruidos pelo XP acumulado da epoca
    // e respeitando a regra de nao regressao caso o aluno ja tivesse um maiorElo superior.
    const xpApos = transacao ? transacao.xpTotalApos : xpTotalAtual;
    const xpAntes = Math.max(0, xpApos - recompensa.xpTotalRecebido);
    const nivelAnterior = calcularNivel(xpAntes);
    const nivelApos = calcularNivel(xpApos);

    const progresso = montarProgressoNivel(xpTotalAtual, maiorElo);
    const progressoDaTentativa =
      xpApos === xpTotalAtual ? progresso : montarProgressoNivel(xpApos, maiorElo);

    const eloAposPeloXp = calcularFaixaEloPorXp(xpApos);
    const novoElo = progressoDaTentativa.eloAtual;
    const eloAnterior =
      novoElo.ordem > eloAposPeloXp.ordem ? novoElo : calcularFaixaEloPorXp(xpAntes);
    const subiuDeElo = novoElo.ordem > eloAnterior.ordem;
    const xpExcedenteElo = progressoDaTentativa.xpNoElo;

    return {
      tentativaId: tentativa.id,
      tema: tentativa.tema,
      dificuldade: tentativa.dificuldade,
      totalQuestoes: tentativa.totalQuestoes,
      totalAcertos: tentativa.totalAcertos ?? 0,
      jaConcluida,
      recompensa,
      progresso,
      subiuDeNivel: nivelApos > nivelAnterior,
      nivelAnterior,
      subiuDeElo,
      eloAnterior,
      novoElo,
      xpExcedenteElo,
    };
  }

  private async buscarTentativaOuFalhar(
    tentativaId: string,
    usuarioId: string,
  ): Promise<TentativaParaConclusao> {
    const tentativa = await this.repository.buscarTentativaParaConclusao(tentativaId, usuarioId);

    if (!tentativa) {
      throw new ErroAplicacao({
        codigoStatus: 404,
        codigo: CodigoDeErro.NAO_ENCONTRADO,
        mensagem: MENSAGENS.tentativaNaoEncontrada,
      });
    }

    return tentativa;
  }

  private exigirUsuario(usuarioId: string): void {
    if (!usuarioId) {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        mensagem: MENSAGENS.usuarioAutenticadoEncontrado,
      });
    }
  }

  // Embaralha (Fisher-Yates) sem mutar o array original. Usa o gerador do
  // modulo crypto em vez de Math.random para atender a regra de seguranca do Sonar.
  private embaralhar<T>(array: T[]): T[] {
    const copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }
}
