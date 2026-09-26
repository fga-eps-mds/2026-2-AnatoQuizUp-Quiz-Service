import type { RespostaQuestaoQuizDto } from "./dto/responses/resposta_questao_quiz_dto";
import { type FiltroListarQuestoesQueryDto } from "../questoes/dto/question.types";
import type { RespostaPaginada } from "@/shared/types/api.types";
import type { QuizRepository } from "./quiz.repository";
import type { FeedbackQuizDto } from "./dto/responses/feedback_quiz_dto";
import type { ResponderQuestaoQuizDto } from "./dto/requests/responder_questao_quiz_dto";
import { MENSAGENS } from "@/shared/constants/mensagens";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { PAPEIS, type Papel } from "@/shared/constants/papeis";
import { converterParaRespostaQuestaoQuiz } from "./dto/mappers/converter_para_resposta_questao_quiz";
import {
  montarMetadadosPaginacao,
  resolverParametrosPaginacao,
} from "@/shared/utils/paginacao.util";
import type { QuantidadeQuestoesPorTema } from "./dto/responses/quantidade_questao_tema_dto";
import { type ResolucaoQuestaoUsuarioDto } from "./dto/responses/resolucao_questao_usuario_dto";
import { converterResolucaoQuestaoBancoToApi } from "./dto/mappers/historico_quiz.mapper";
import type { Dificuldade } from "@prisma/client";
import type { ConquistaService } from "../conquistas/conquistas.service";
import type { UsoItemRepository } from "../loja/uso-item.repository";

// Recompensa em moedas por acerto, conforme a dificuldade da questao.
const MOEDAS_POR_DIFICULDADE: Record<Dificuldade, number> = {
  FACIL: 10,
  MEDIA: 25,
  DIFICIL: 50,
};

/**
 * Service do quiz (modo de pratica do aluno).
 *
 * Sorteia questoes para o quiz, processa respostas (corrige, registra tentativa,
 * concede moedas e dispara conquistas), consulta saldo, quantidades por tema e o
 * historico de respostas do usuario.
 */
export class QuizService {
  constructor(
    private readonly quizRepository: QuizRepository,
    private readonly conquistaService: ConquistaService,
    private readonly usoItemRepository?: UsoItemRepository,
  ) {}

  /**
   * Busca uma leva de questoes para o quiz, com filtros e ordem aleatoria.
   *
   * Usa um deslocamento (skip) aleatorio sobre o total filtrado para variar as
   * questoes a cada chamada, e ainda embaralha o resultado retornado.
   *
   * @param query Filtros do quiz (tema, dificuldade etc.) e paginacao.
   * @returns Pagina de questoes do quiz embaralhadas.
   * @throws ErroAplicacao 404 quando nenhuma questao atende aos filtros.
   */
  async buscarQuestoesQuiz(
    query: FiltroListarQuestoesQueryDto,
  ): Promise<RespostaPaginada<RespostaQuestaoQuizDto>> {
    const paginacao = resolverParametrosPaginacao(query);

    // Sorteia um ponto de inicio aleatorio para nao trazer sempre as mesmas questoes.
    const num_questoes_quiz = await this.quizRepository.contarQuestoesQuiz(query);
    if (num_questoes_quiz) {
      const randomSkip = Math.floor(Math.random() * num_questoes_quiz);
      paginacao.skip = randomSkip;
    }
    const { data, total } = await this.quizRepository.filtrarQuestoesQuiz(paginacao, query);

    if (!data || data.length === 0) {
      throw new ErroAplicacao({
        codigoStatus: 404,
        codigo: CodigoDeErro.NAO_ENCONTRADO,
        mensagem: MENSAGENS.questaoNaoEncontrada,
      });
    }

    // Converte para o DTO do quiz (sem expor o gabarito) e embaralha a ordem.
    const questoes_quiz = data.map(converterParaRespostaQuestaoQuiz);
    const questoes_quiz_embaralhadas = this.embaralhar<RespostaQuestaoQuizDto>(questoes_quiz);

    return {
      dados: questoes_quiz_embaralhadas,
      metadados: montarMetadadosPaginacao(paginacao, total),
    };
  }

  /**
   * Processa a resposta de uma questao no quiz e devolve o feedback.
   *
   * Valida o gabarito, registra a tentativa, corrige a resposta e, somente para
   * ALUNO, processa conquistas e concede moedas (uma vez por questao). Retorna a
   * correcao, o "saiba mais", o saldo e as conquistas eventualmente desbloqueadas.
   *
   * @param data Questao e alternativa marcada.
   * @param id_usuario Aluno que respondeu.
   * @param papel_usuario Papel do usuario (so ALUNO ganha recompensas).
   * @returns Feedback da resposta.
   * @throws ErroAplicacao 401 conforme autenticacao/registro.
   */
  async responderQuestaoQuiz(
    data: ResponderQuestaoQuizDto,
    id_usuario: string,
    papel_usuario?: Papel,
  ): Promise<FeedbackQuizDto> {
    if (id_usuario === "") {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        mensagem: MENSAGENS.usuarioAutenticadoEncontrado,
      });
    }

    // Gabarito (resposta correta + metadados) da questao respondida.
    const gabarito = await this.quizRepository.buscarResposta(data.questaoId);

    if (!gabarito) {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.ERRO_FEEDBACK,
        mensagem: MENSAGENS.erroFeedback,
      });
    }

    // Registra a tentativa (compoe o historico do aluno).
    const tentativa_registrada = await this.quizRepository.registrarTentativa(data, id_usuario);

    if (!tentativa_registrada) {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.ERRO_TENTATIVA,
        mensagem: MENSAGENS.erroTentativa,
      });
    }

    // Correcao = alternativa marcada igual ao gabarito. So aluno ganha recompensas.
    const correcao = gabarito.respostaCorreta === data.respostaMarcada;
    const alunoPodeReceberRecompensas = papel_usuario === PAPEIS.ALUNO;

    // Conquistas so sao processadas para alunos (professor/admin nao pontuam).
    const conquistas = alunoPodeReceberRecompensas
      ? await this.conquistaService.processarRespostaQuestao(
          id_usuario,
          gabarito.temaId,
          gabarito.tema.nome,
          correcao,
        )
      : [];

    let moedasConcedidas = 0;
    let moedasJaConcedidas = false;
    let potencializadorAplicado: FeedbackQuizDto["potencializadorAplicado"] = null;

    // Moedas so no primeiro acerto da questao (o repository evita pagar duas vezes).
    if (correcao && alunoPodeReceberRecompensas) {
      const resultado = await this.quizRepository.concederMoedasPorAcerto(
        id_usuario,
        data.questaoId,
        MOEDAS_POR_DIFICULDADE[gabarito.dificuldade],
      );

      moedasConcedidas = resultado.moedasConcedidas;
      moedasJaConcedidas = resultado.moedasJaConcedidas;

      // O Cafe do Foco so e gasto no primeiro acerto que realmente recebeu ATP.
      // Assim, acertar de novo uma questao ja premiada nao desperdiça o item.
      if (resultado.moedasConcedidas > 0 && this.usoItemRepository) {
        const bonus = await this.usoItemRepository.aplicarCafeNoAcerto(
          id_usuario,
          data.questaoId,
          resultado.moedasConcedidas,
        );

        if (bonus.bonusMoedas > 0) {
          moedasConcedidas += bonus.bonusMoedas;
          potencializadorAplicado = {
            nome: bonus.uso?.itemLoja.nome ?? "Cafe do Foco",
            bonusMoedas: bonus.bonusMoedas,
          };
        }
      }
    }

    const saldoMoedas = await this.quizRepository.buscarSaldoMoedas(id_usuario);

    return {
      correcao,
      saibaMais: gabarito.saibaMais ?? "",
      respostaCorreta: gabarito.respostaCorreta,
      saldoMoedas,
      moedasConcedidas,
      moedasJaConcedidas,
      conquistasDesbloqueadas: conquistas,
      potencializadorAplicado,
    };
  }

  // Retorna o saldo de moedas do usuario (exige autenticacao).
  async buscarSaldoMoedas(id_usuario: string): Promise<{ saldoMoedas: number }> {
    if (id_usuario === "") {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        mensagem: MENSAGENS.usuarioAutenticadoEncontrado,
      });
    }

    const saldoMoedas = await this.quizRepository.buscarSaldoMoedas(id_usuario);

    return { saldoMoedas };
  }

  // Embaralha um array (Fisher-Yates) sem mutar o original, para variar a ordem das questoes.
  private embaralhar<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Agrega, por tema, o total de questoes e a contagem por dificuldade (para a tela inicial).
  async buscarQuantidadeDeQuestoesPorTema(): Promise<QuantidadeQuestoesPorTema[]> {
    const temas = await this.quizRepository.buscarQuantidadeDeQuestoesPorTema();

    if (!temas) {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.TEMAS_NAO_ENCONTRADOS,
        mensagem: MENSAGENS.temasNaoEncontrados,
      });
    }

    return temas.map((tema) => {
      // Conta as questoes do tema por faixa de dificuldade.
      const quantidadePorDificuldade = { FACIL: 0, MEDIA: 0, DIFICIL: 0 };
      tema.questoes.forEach((questao) => {
        quantidadePorDificuldade[questao.dificuldade]++;
      });

      return {
        nome: tema.nome,
        totalQuestoes: tema._count.questoes,
        porDificuldade: quantidadePorDificuldade,
      };
    });
  }

  // Lista paginada do historico de questoes respondidas pelo usuario (com filtros).
  async buscarHistorico(
    usuarioId: string | undefined,
    query: FiltroListarQuestoesQueryDto,
  ): Promise<RespostaPaginada<ResolucaoQuestaoUsuarioDto>> {
    if (usuarioId === "" || usuarioId === undefined) {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        mensagem: MENSAGENS.usuarioAutenticadoEncontrado,
      });
    }

    const paginacao = resolverParametrosPaginacao(query);
    const { data, total } = await this.quizRepository.listarQuestoesRespondidas(
      usuarioId,
      paginacao,
      query,
    );

    if (!data || data.length === 0) {
      return { dados: [], metadados: montarMetadadosPaginacao(paginacao, 0) };
    }

    const dados = data.map((item) => {
      return converterResolucaoQuestaoBancoToApi(item, 1, { [item.respostaMarcada]: 1 });
    });

    return {
      dados,
      metadados: montarMetadadosPaginacao(paginacao, total),
    };
  }
}
