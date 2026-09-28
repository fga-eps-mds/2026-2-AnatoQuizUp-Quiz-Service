import { MENSAGENS } from "@/shared/constants/mensagens";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";
import type { RespostaPaginada } from "@/shared/types/api.types";
import {
  montarMetadadosPaginacao,
  resolverParametrosPaginacao,
} from "@/shared/utils/paginacao.util";
import type {
  AtualizarQuestaoDto,
  CriarQuestaoDto,
  ListarQuestoesQueryDto,
  FiltroListarQuestoesQueryDto,
  RespostaQuestaoDto,
  AlternativasQuestaoDto,
} from "./dto/question.types";
import {
  TIPO_QUESTAO_API,
  converterParaRespostaQuestao,
} from "./dto/question.types";
import type { QuestionRepository } from "./questoes.repository";
import type { AlternativaQuestao, Dificuldade } from "@prisma/client";
import type { MinioService } from "./minio.service";
import { eventEmitter } from "@/shared/events/event-emitter";

/**
 * Service de questoes.
 *
 * Cuida do CRUD de questoes (com upload de imagem no MinIO), validacao por tipo de
 * questao e da consolidacao para o DTO de resposta. Ao criar uma questao com tema
 * novo, emite o evento "tema.criado" (consumido pelas conquistas de tema).
 */
export class QuestionService {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly minioService?: MinioService,
  ) {}

  // Lista paginada de questoes, ja convertidas para o DTO de resposta.
  async listar(query: ListarQuestoesQueryDto): Promise<RespostaPaginada<RespostaQuestaoDto>> {
    const paginacao = resolverParametrosPaginacao(query);
    const { data, total } = await this.questionRepository.listar(paginacao);

    return {
      dados: data.map(converterParaRespostaQuestao),
      metadados: montarMetadadosPaginacao(paginacao, total),
    };
  }

  // Busca uma questao por id (404 se nao existir).
  async buscarPorId(id: string): Promise<RespostaQuestaoDto> {
    const questao = await this.questionRepository.buscarPorId(id);

    if (!questao) {
      throw this.erroQuestaoNaoEncontrada(id);
    }

    return converterParaRespostaQuestao(questao);
  }

  // Lista paginada com filtros (tema, dificuldade etc.) aplicados no repository.
  async filtrar(
    query: FiltroListarQuestoesQueryDto,
  ): Promise<RespostaPaginada<RespostaQuestaoDto>> {
    const paginacao = resolverParametrosPaginacao(query);
    const { data, total } = await this.questionRepository.filtrar(paginacao, query);

    return {
      dados: data.map(converterParaRespostaQuestao),
      metadados: montarMetadadosPaginacao(paginacao, total),
    };
  }

  /**
   * Cria uma questao, com upload opcional de imagem.
   *
   * Valida o autor e as regras do tipo de questao, sobe a imagem ao MinIO (se houver)
   * e persiste. Se o tema foi criado junto, emite o evento que dispara a conquista do tema.
   *
   * @param data Dados da questao.
   * @param arquivoImagem Imagem enviada (opcional).
   * @param criadoPorId Professor autor.
   * @returns A questao criada no formato de resposta.
   * @throws ErroAplicacao 401/400 conforme autor/validacao.
   */
  async criar(
    data: CriarQuestaoDto,
    arquivoImagem: Express.Multer.File | undefined,
    criadoPorId: string,
  ): Promise<RespostaQuestaoDto> {
    if (!criadoPorId) {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        mensagem: MENSAGENS.tokenInvalido,
      });
    }

    // Regras de obrigatoriedade variam conforme o tipo de questao.
    this.validarQuestao(data);

    // Sobe a imagem ao MinIO quando enviada; senao mantem a URL/valor que veio.
    let urlImagemMinio: string | undefined = undefined;

    if (arquivoImagem) {
      urlImagemMinio = await this.enviarImagem(arquivoImagem);
    }

    const dadosParaSalvar = {
      ...data,
      imagem: urlImagemMinio ?? data.imagem ?? "",
    };

    const resultado = await this.questionRepository.criar(dadosParaSalvar, criadoPorId);

    // Tema novo => avisa o modulo de conquistas para criar a conquista do tema.
    if (resultado.temaCriado) {
      eventEmitter.emit("tema.criado", {
        temaId: resultado.questao.tema.id,
        nomeTema: resultado.questao.tema.nome,
      });
    }

    return converterParaRespostaQuestao(resultado.questao);
  }

  /**
   * Atualiza uma questao existente (edicao parcial com merge dos campos).
   *
   * Cada campo nao informado mantem o valor atual da questao; a imagem so e trocada
   * se um novo arquivo vier. As alternativas atuais sao reaproveitadas quando nao enviadas.
   *
   * @param id Questao a atualizar.
   * @param data Campos a alterar (parciais).
   * @param arquivoImagem Nova imagem (opcional).
   * @param usuarioId Autor da edicao.
   * @returns A questao atualizada no formato de resposta.
   * @throws ErroAplicacao 404 se a questao nao existir.
   */
  async atualizar(
    id: string,
    data: AtualizarQuestaoDto,
    arquivoImagem: Express.Multer.File | undefined,
    usuarioId: string,
  ): Promise<RespostaQuestaoDto> {
    const questaoAntiga = await this.questionRepository.buscarPorId(id);
    if (!questaoAntiga) throw this.erroQuestaoNaoEncontrada(id);

    let urlImagemFinal = questaoAntiga.urlImagem ?? "";

    if (arquivoImagem) {
      urlImagemFinal = await this.enviarImagem(arquivoImagem);
    }

    // Merge: usa o valor enviado ou, na ausencia, o valor atual da questao.
    const dadosNovaQuestao: CriarQuestaoDto = {
      tema: data.tema ?? questaoAntiga.tema.nome,
      enunciado: data.enunciado ?? questaoAntiga.enunciado,
      tipo: data.tipo ?? questaoAntiga.tipoQuestao,
      dificuldade: (data.dificuldade ?? questaoAntiga.dificuldade) as Dificuldade,
      imagem: urlImagemFinal,
      alternativaCorreta: (data.alternativaCorreta ??
        questaoAntiga.respostaCorreta) as AlternativaQuestao,
      saibaMais: data.saibaMais ?? questaoAntiga.saibaMais ?? "",
      taxonomiaBloom: data.taxonomiaBloom ?? questaoAntiga.taxonomiaBloom ?? undefined,
      origemQuestao: data.origemQuestao ?? questaoAntiga.origemQuestao,
      regiaoAnatomica: data.regiaoAnatomica ?? questaoAntiga.regiaoAnatomica ?? undefined,
      palavrasChave: data.palavrasChave ?? questaoAntiga.palavrasChave,
      alternativas: (data.alternativas ??
        this.extrairAlternativasAtuais(questaoAntiga)) as AlternativasQuestaoDto,
    };

    const novaQuestao = await this.questionRepository.atualizar(id, dadosNovaQuestao, usuarioId);

    return converterParaRespostaQuestao(novaQuestao);
  }

  // Remove a questao (desativacao/soft delete no repository); 404 se nao existir.
  async remover(id: string): Promise<RespostaQuestaoDto> {
    const questao = await this.questionRepository.buscarPorId(id);

    if (!questao) {
      throw this.erroQuestaoNaoEncontrada(id);
    }

    const questaoRemovida = await this.questionRepository.desativar(id);

    return converterParaRespostaQuestao(questaoRemovida);
  }

  private async enviarImagem(arquivoImagem: Express.Multer.File): Promise<string> {
    if (!this.minioService) {
      throw new ErroAplicacao({
        codigoStatus: 503,
        codigo: CodigoDeErro.SERVICO_INDISPONIVEL,
        mensagem: MENSAGENS.uploadImagemIndisponivel,
      });
    }

    return this.minioService.uploadImagem(arquivoImagem);
  }

  /**
   * Valida as regras de cada tipo de questao antes de salvar.
   *
   * Exige gabarito e alternativas; em MULTIPLA_ESCOLHA cobra A-E preenchidas; em
   * CERTO_ERRADO cobra as opcoes C/E e que o gabarito seja C ou E.
   *
   * @param data Dados da questao a validar.
   * @throws ErroAplicacao 400 quando alguma regra do tipo nao e satisfeita.
   */
  private validarQuestao(data: CriarQuestaoDto) {
    if (!data.alternativaCorreta) {
      throw new ErroAplicacao({
        codigoStatus: 400,
        codigo: CodigoDeErro.ERRO_DE_VALIDACAO,
        mensagem: MENSAGENS.questaoGabaritoObrigatorio,
      });
    }

    if (!data.alternativas || Object.keys(data.alternativas).length === 0) {
      throw new ErroAplicacao({
        codigoStatus: 400,
        codigo: CodigoDeErro.ERRO_DE_VALIDACAO,
        mensagem: MENSAGENS.questaoAlternativasObrigatorias,
      });
    }

    // Multipla escolha: exige as cinco alternativas (A-E) preenchidas.
    if (data.tipo === TIPO_QUESTAO_API.MULTIPLA_ESCOLHA) {
      const alternativasObrigatorias = ["A", "B", "C", "D", "E"] as const;
      const possuiTodas = alternativasObrigatorias.every((alternativa) => {
        const valor = data.alternativas[alternativa as keyof typeof data.alternativas];

        return typeof valor === "string" && valor.trim().length > 0;
      });

      if (!possuiTodas) {
        throw new ErroAplicacao({
          codigoStatus: 400,
          codigo: CodigoDeErro.ERRO_DE_VALIDACAO,
          mensagem: MENSAGENS.questaoAlternativasObrigatorias,
        });
      }
    }

    // Certo/errado: exige as opcoes C e E preenchidas e o gabarito sendo C ou E.
    if (data.tipo === TIPO_QUESTAO_API.CERTO_ERRADO) {
      const alternativas = data.alternativas;
      const possuiVerdadeiroFalso =
        typeof alternativas.C === "string" &&
        alternativas.C.trim().length > 0 &&
        typeof alternativas.E === "string" &&
        alternativas.E.trim().length > 0;

      if (!possuiVerdadeiroFalso) {
        throw new ErroAplicacao({
          codigoStatus: 400,
          codigo: CodigoDeErro.ERRO_DE_VALIDACAO,
          mensagem: MENSAGENS.questaoAlternativasObrigatorias,
        });
      }

      if (data.alternativaCorreta !== "C" && data.alternativaCorreta !== "E") {
        throw new ErroAplicacao({
          codigoStatus: 400,
          codigo: CodigoDeErro.ERRO_DE_VALIDACAO,
          mensagem: MENSAGENS.questaoGabaritoObrigatorio,
        });
      }
    }
  }

  // Erro 404 padronizado de questao nao encontrada.
  private erroQuestaoNaoEncontrada(id: string) {
    return new ErroAplicacao({
      codigoStatus: 404,
      codigo: CodigoDeErro.NAO_ENCONTRADO,
      mensagem: MENSAGENS.questaoNaoEncontrada,
      detalhes: { id },
    });
  }

  // Extrai as alternativas atuais no formato A-E (ou C/E p/ certo-errado) para o merge da edicao.
  private extrairAlternativasAtuais(
    questao: Awaited<ReturnType<QuestionRepository["buscarPorId"]>>,
  ) {
    if (!questao?.alternativas) {
      return {};
    }

    if (questao.tipoQuestao === "CERTO_ERRADO") {
      return {
        C: questao.alternativas.alternativaC,
        E: questao.alternativas.alternativaE,
      };
    }

    return {
      A: questao.alternativas.alternativaA,
      B: questao.alternativas.alternativaB,
      C: questao.alternativas.alternativaC,
      D: questao.alternativas.alternativaD,
      E: questao.alternativas.alternativaE,
    };
  }
}
