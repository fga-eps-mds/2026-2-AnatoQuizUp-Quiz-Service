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

import {
  aplicarInatividade,
  aplicarInatividadeEmLote,
  buscarConfiguracao,
  buscarConfiguracaoCompleta,
  listarHistoricoElo,
  listarNotificacoes,
  marcarNotificacaoLida,
  montarRetratoInatividade,
  salvarConfiguracao,
} from "./elo.repository";
import { LIMITE_QUESTOES_POR_RODADA } from "./progressao.constants";
import {
  calcularFaixaEloPorXp,
  calcularNivel,
  calcularRecompensaXp,
  montarProgressoNivel,
  obterFaixaEloPorCodigo,
} from "./progressao.regras";
import type { ProgressaoRepository, TentativaParaConclusao } from "./progressao.repository";
import type {
  ConfiguracaoInatividadeDto,
  EventoEloDto,
  HistoricoXpItemDto,
  HistoricoXpQueryDto,
  IniciarTentativaDto,
  NotificacaoEloDto,
  ProgressoNivelDto,
  RecompensaXpDto,
  ResultadoTentativaDto,
  ResultadoVerificacaoInatividadeDto,
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
   * Nivel, elo e estado de inatividade atuais do usuario.
   *
   * Antes de responder, aplica os rebaixamentos ja vencidos: e o que faz os cenarios
   * "Quando sua progressao for consultada" valerem mesmo que a rotina em lote nao tenha
   * rodado ainda.
   *
   * @param usuarioId Usuario autenticado.
   * @returns XP total, XP de elo, nivel, elo, estado e prazo de rebaixamento.
   */
  async buscarProgresso(usuarioId: string): Promise<ProgressoNivelDto> {
    this.exigirUsuario(usuarioId);

    const { dados, retrato } = await aplicarInatividade(usuarioId);

    return montarProgressoNivel(dados, retrato);
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

  /**
   * Historico paginado de progressao de elo do usuario: promocoes, rebaixamentos por
   * inatividade e recuperacoes.
   *
   * @param usuarioId Usuario autenticado.
   * @param query Paginacao.
   * @returns Pagina do historico de elo.
   */
  async buscarHistoricoElo(
    usuarioId: string,
    query: HistoricoXpQueryDto,
  ): Promise<RespostaPaginada<EventoEloDto>> {
    this.exigirUsuario(usuarioId);

    const paginacao = resolverParametrosPaginacao(query);
    const { data, total } = await listarHistoricoElo(usuarioId, paginacao);

    const dados: EventoEloDto[] = data.map((evento) => ({
      id: evento.id,
      data: evento.criadoEm.toISOString(),
      tipo: evento.tipo,
      eloAnterior: obterFaixaEloPorCodigo(evento.eloAnterior),
      eloNovo: obterFaixaEloPorCodigo(evento.eloNovo),
      xpEloAntes: evento.xpEloAntes,
      xpEloDepois: evento.xpEloDepois,
      diasInatividade: evento.diasInatividade,
    }));

    return { dados, metadados: montarMetadadosPaginacao(paginacao, total) };
  }

  /**
   * Avisos de elo do proprio usuario (aviso preventivo, risco, vespera, rebaixamento e
   * recuperacao). Nunca aceita o id de outro estudante: o destinatario e sempre o
   * usuario autenticado.
   *
   * @param usuarioId Usuario autenticado.
   * @param apenasNaoLidas Filtra os avisos ainda nao lidos.
   * @returns Avisos do usuario, mais recentes primeiro.
   */
  async buscarNotificacoes(
    usuarioId: string,
    apenasNaoLidas = false,
  ): Promise<NotificacaoEloDto[]> {
    this.exigirUsuario(usuarioId);

    // Garante que os avisos ja vencidos existam antes da leitura.
    await aplicarInatividade(usuarioId);

    const notificacoes = await listarNotificacoes(usuarioId, apenasNaoLidas);

    return notificacoes.map((notificacao) => ({
      id: notificacao.id,
      data: notificacao.criadoEm.toISOString(),
      tipo: notificacao.tipo,
      titulo: notificacao.titulo,
      mensagem: notificacao.mensagem,
      eloRelacionado: notificacao.eloRelacionado,
      prazoRebaixamentoEm: notificacao.prazoRebaixamentoEm
        ? notificacao.prazoRebaixamentoEm.toISOString()
        : null,
      lida: notificacao.lidaEm !== null,
    }));
  }

  /**
   * Marca um aviso do proprio usuario como lido.
   *
   * @param id Id da notificacao.
   * @param usuarioId Usuario autenticado.
   * @throws ErroAplicacao 404 se a notificacao nao existir ou nao for do usuario.
   */
  async marcarNotificacaoLida(id: string, usuarioId: string): Promise<void> {
    this.exigirUsuario(usuarioId);

    const marcada = await marcarNotificacaoLida(id, usuarioId);

    if (!marcada) {
      throw new ErroAplicacao({
        codigoStatus: 404,
        codigo: CodigoDeErro.NAO_ENCONTRADO,
        mensagem: "Notificação não encontrada.",
      });
    }
  }

  /**
   * Rotina autorizada de verificacao de inatividade: avalia todos os estudantes com
   * inatividade acumulada e aplica o que estiver vencido.
   *
   * Nao recebe identificador de usuario — cada conta e avaliada pelos proprios dados de
   * atividade, entao a chamada nao pode ser usada para agir sobre a conta de outro.
   *
   * @returns Totais avaliados, rebaixados e notificados.
   */
  async verificarInatividade(): Promise<ResultadoVerificacaoInatividadeDto> {
    return await aplicarInatividadeEmLote();
  }

  /**
   * Prazos vigentes da regra de inatividade (uso administrativo).
   *
   * @returns Configuracao atual.
   */
  async buscarConfiguracaoInatividade(): Promise<ConfiguracaoInatividadeDto> {
    return this.converterConfiguracao(await buscarConfiguracaoCompleta());
  }

  /**
   * Altera os prazos da regra de inatividade. A restricao ao papel administrativo e
   * feita na rota; aqui so registramos quem alterou.
   *
   * @param dados Novos prazos e janelas de indisponibilidade.
   * @param usuarioId Administrador responsavel.
   * @returns Configuracao atualizada.
   */
  async salvarConfiguracaoInatividade(
    dados: {
      diasAviso: number;
      diasRisco: number;
      diasRebaixamento: number;
      diasEntreRebaixamentos: number;
      indisponibilidades: { inicio: string; fim: string }[];
    },
    usuarioId: string,
  ): Promise<ConfiguracaoInatividadeDto> {
    this.exigirUsuario(usuarioId);

    return this.converterConfiguracao(await salvarConfiguracao(dados, usuarioId));
  }

  private converterConfiguracao(linha: {
    diasAviso: number;
    diasRisco: number;
    diasRebaixamento: number;
    diasEntreRebaixamentos: number;
    indisponibilidades: unknown;
    atualizadoPorId: string | null;
    atualizadoEm: Date | null;
  }): ConfiguracaoInatividadeDto {
    return {
      diasAviso: linha.diasAviso,
      diasRisco: linha.diasRisco,
      diasRebaixamento: linha.diasRebaixamento,
      diasEntreRebaixamentos: linha.diasEntreRebaixamentos,
      indisponibilidades: Array.isArray(linha.indisponibilidades)
        ? (linha.indisponibilidades as { inicio: string; fim: string }[])
        : [],
      atualizadoPorId: linha.atualizadoPorId,
      // null = nenhum administrador alterou os prazos ainda (valem os padroes da US).
      atualizadoEm: linha.atualizadoEm ? linha.atualizadoEm.toISOString() : null,
    };
  }

  // Monta o resultado a partir do que esta gravado na rodada (base da idempotencia).
  private async montarResultado(
    tentativa: TentativaParaConclusao,
    jaConcluida: boolean,
  ): Promise<ResultadoTentativaDto> {
    const transacao = tentativa.transacaoXp;
    const estado = await this.repository.buscarDadosProgresso(tentativa.usuarioId);
    const xpTotalAtual = estado.xpTotal;

    const recompensa: RecompensaXpDto = transacao
      ? {
          xpBase: transacao.xpBase,
          bonusDesempenho: transacao.bonusDesempenho,
          bonusPowerUp: transacao.bonusPowerUp,
          xpTotalRecebido: transacao.quantidade,
        }
      : RECOMPENSA_ZERADA;

    // Nivel antes/depois desta rodada, reconstruido pelo XP total da epoca.
    const xpApos = transacao ? transacao.xpTotalApos : xpTotalAtual;
    const nivelAnterior = calcularNivel(Math.max(0, xpApos - recompensa.xpTotalRecebido));
    const nivelApos = calcularNivel(xpApos);

    const config = await buscarConfiguracao();
    const progresso = montarProgressoNivel(
      estado,
      montarRetratoInatividade(estado, new Date(), config),
    );

    // Elo antes/depois DESTA rodada, reconstruido pelo XP de elo gravado na transacao.
    // Usar o saldo atual aqui seria errado numa chamada repetida (o endpoint e
    // idempotente): o aluno pode ter ganhado XP depois, e a rodada antiga passaria a
    // reivindicar uma subida de elo que nao foi dela.
    const xpEloApos = transacao ? transacao.xpEloApos : estado.xpElo;
    const eloAnterior = calcularFaixaEloPorXp(Math.max(0, xpEloApos - recompensa.xpTotalRecebido));
    const novoElo = transacao
      ? calcularFaixaEloPorXp(xpEloApos)
      : obterFaixaEloPorCodigo(estado.eloAtual);
    const subiuDeElo = novoElo.ordem > eloAnterior.ordem;
    const xpExcedenteElo = Math.max(0, xpEloApos - novoElo.xpMinimo);

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
