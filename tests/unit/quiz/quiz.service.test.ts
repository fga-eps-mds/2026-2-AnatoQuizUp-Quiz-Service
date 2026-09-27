import { QuizService } from "@/modules/quiz/quiz.service";
import { converterParaRespostaQuestaoQuiz } from "@/modules/quiz/dto/mappers/converter_para_resposta_questao_quiz";
import type { RespostaQuestaoQuizDto } from "@/modules/quiz/dto/responses/resposta_questao_quiz_dto";
import type { QuizRepository } from "@/modules/quiz/quiz.repository";
import {
  DIFICULDADE_API,
  TIPO_QUESTAO_API,
  type FiltroListarQuestoesQueryDto,
  type RegistroQuestaoCompleta,
} from "@/modules/questoes/dto/question.types";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { MENSAGENS } from "@/shared/constants/mensagens";
import type { ResponderQuestaoQuizDto } from "@/modules/quiz/dto/requests/responder_questao_quiz_dto";
import { PAPEIS } from "@/shared/constants/papeis";
import { AlternativaQuestao, Dificuldade, type ResolucaoQuestao } from "@prisma/client";
import type { ConquistaService } from "@/modules/conquistas/conquistas.service";
import type { ConquistaDesbloqueadaDto } from "@/modules/conquistas/conquistas.dto";
import type { UsoItemRepository } from "@/modules/loja/uso-item.repository";

function criarQuestoes(
  ids: string[] = ["id-1", "id-2", "id-3", "id-4"],
): RegistroQuestaoCompleta[] {
  const agora = new Date("2026-05-09T12:00:00.000Z");

  return ids.map((id) => {
    return {
      id: id,
      enunciado: "Qual estrutura bombeia sangue para a aorta?",
      tipoQuestao: "MULTIPLA_ESCOLHA",
      respostaCorreta: "B",
      saibaMais: "O ventriculo esquerdo impulsiona sangue para a circulacao sistemica.",
      status: "ATIVO",
      origemQuestao: "ELABORADA_POR_PROFESSOR",
      taxonomiaBloom: null,
      regiaoAnatomica: null,
      urlImagem: "https://cdn.example.com/coracao.png",
      criadoPorId: "professor-1",
      temaId: "tema-1",
      questaoOriginalId: null,
      dificuldade: DIFICULDADE_API.MEDIA,
      criadoEm: agora,
      atualizadoEm: agora,
      excluidoEm: null,
      tema: {
        id: "tema-1",
        nome: "Sistema cardiovascular",
        criadoEm: agora,
        atualizadoEm: agora,
        excluidoEm: null,
      },
      alternativas: {
        id: "alternativas-1",
        alternativaA: "Atrio direito",
        alternativaB: "Ventriculo esquerdo",
        alternativaC: "Atrio esquerdo",
        alternativaD: "Ventriculo direito",
        alternativaE: "Veia cava",
        questaoId: "questao-1",
        criadoEm: agora,
        atualizadoEm: agora,
        excluidoEm: null,
      },
    };
  });
}

function converterArrayParaQuestoesQuiz(
  questoes_completas: RegistroQuestaoCompleta[],
): RespostaQuestaoQuizDto[] {
  return questoes_completas.map((questao) => converterParaRespostaQuestaoQuiz(questao));
}

function criarTentativa() {
  const agora = new Date("2026-05-09T12:00:00.000Z");

  return {
    id: "tentativa-id",
    criadoEm: agora,
    atualizadoEm: agora,
    excluidoEm: null,
    questaoId: "questao-id",
    respostaMarcada: AlternativaQuestao.E,
    usuarioId: "usuario-id",
  };
}

function criarFeedback(
  alternativa: AlternativaQuestao = AlternativaQuestao.E,
  dificuldade: Dificuldade = Dificuldade.MEDIA,
) {
  const agora = new Date("2026-05-09T12:00:00.000Z");
  return {
    respostaCorreta: alternativa,
    saibaMais: "explicação",
    dificuldade,

    conquistasDesbloqueadas: [],
    temaId: "tema-id",
    tema: {
      id: "tema-id",
      nome: "tema-nome",
      criadoEm: agora,
      atualizadoEm: agora,
      excluidoEm: null,
    },
  };
}

function criarResponderQuestaoQuizDto(): ResponderQuestaoQuizDto {
  return {
    questaoId: "questa-id",
    tipo: "MULTIPLA_ESCOLHA",
    respostaMarcada: "E",
  };
}

function criarFiltroListarQuestoesQueryDto(): FiltroListarQuestoesQueryDto {
  return {
    page: 1,
    limit: 4,
    tema: undefined,
    dificuldade: DIFICULDADE_API.DIFICIL,
    tipo: undefined,
  };
}

function criarRepositoryMock() {
  return {
    filtrarQuestoesQuiz: jest.fn<QuizRepository["filtrarQuestoesQuiz"]>(),
    registrarTentativa: jest.fn<QuizRepository["registrarTentativa"]>(),
    buscarResposta: jest.fn<QuizRepository["buscarResposta"]>(),
    buscarSaldoMoedas: jest.fn<QuizRepository["buscarSaldoMoedas"]>(),
    concederMoedasPorAcerto: jest.fn<QuizRepository["concederMoedasPorAcerto"]>(),
    contarQuestoesQuiz: jest.fn<QuizRepository["contarQuestoesQuiz"]>(),
    buscarQuantidadeDeQuestoesPorTema:
      jest.fn<QuizRepository["buscarQuantidadeDeQuestoesPorTema"]>(),
    listarQuestoesRespondidas: jest.fn<QuizRepository["listarQuestoesRespondidas"]>(),
  } as unknown as jest.Mocked<QuizRepository>;
}

function criarConquistasServiceMock() {
  return {
    processarRespostaQuestao: jest.fn<ConquistaService["processarRespostaQuestao"]>(),
  } as unknown as jest.Mocked<ConquistaService>;
}

function criarUsoItemRepositoryMock() {
  return {
    aplicarCafeNoAcerto: jest.fn<UsoItemRepository["aplicarCafeNoAcerto"]>(),
  } as unknown as jest.Mocked<UsoItemRepository>;
}

jest.retryTimes(3);

describe("Testa Quiz Service", () => {
  let repository: jest.Mocked<QuizRepository>;
  let quizService: QuizService;
  let conquistaService: jest.Mocked<ConquistaService>;

  beforeEach(() => {
    repository = criarRepositoryMock();
    conquistaService = criarConquistasServiceMock();
    quizService = new QuizService(repository, conquistaService);
    repository.buscarSaldoMoedas.mockResolvedValue(0);
    jest.clearAllMocks();
  });

  test("Filtrar questoes para quiz", async () => {
    const mockRepositoryResponse = { data: criarQuestoes(), total: 4 };
    repository.filtrarQuestoesQuiz.mockResolvedValue(mockRepositoryResponse);

    const filtro: FiltroListarQuestoesQueryDto = {
      page: 1,
      limit: 4,
      tema: undefined,
      dificuldade: DIFICULDADE_API.DIFICIL,
      tipo: undefined,
    };

    const resultado = await quizService.buscarQuestoesQuiz(filtro);

    expect(repository.filtrarQuestoesQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        limit: 4,
      }),
      expect.objectContaining({
        dificuldade: DIFICULDADE_API.DIFICIL,
      }),
    );
    expect(resultado.metadados.total).toBe(4);
    expect(resultado.dados[0]).not.toHaveProperty("saibaMais");
    expect(resultado.dados[0]).not.toHaveProperty("respostaCorreta");
  });

  test("Deve calcular skip aleatório baseado no total de questões", async () => {
    repository.contarQuestoesQuiz.mockResolvedValue(20);

    repository.filtrarQuestoesQuiz.mockResolvedValue({
      data: criarQuestoes(),
      total: 20,
    });

    jest.spyOn(Math, "random").mockReturnValue(0.5);

    const filtro: FiltroListarQuestoesQueryDto = {
      page: 1,
      limit: 4,
    };

    await quizService.buscarQuestoesQuiz(filtro);

    expect(repository.contarQuestoesQuiz).toHaveBeenCalledWith(filtro);

    expect(repository.filtrarQuestoesQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        limit: 4,
      }),
      filtro,
    );
  });

  test("Não deve alterar skip quando não houver questões", async () => {
    repository.contarQuestoesQuiz.mockResolvedValue(0);

    repository.filtrarQuestoesQuiz.mockResolvedValue({
      data: criarQuestoes(),
      total: 0,
    });

    const filtro: FiltroListarQuestoesQueryDto = {
      page: 1,
      limit: 4,
    };

    await quizService.buscarQuestoesQuiz(filtro);

    expect(repository.filtrarQuestoesQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        limit: 4,
      }),
      filtro,
    );
  });

  test("Deve lançar erro caso nenhuma questão seja encotrada", async () => {
    const mockRepositoryResponse = {
      data: undefined as unknown as RegistroQuestaoCompleta[],
      total: 0,
    };
    repository.filtrarQuestoesQuiz.mockResolvedValue(mockRepositoryResponse);

    const filtro = criarFiltroListarQuestoesQueryDto();

    const not_nound_error = new ErroAplicacao({
      codigoStatus: 422,
      codigo: CodigoDeErro.NAO_ENCONTRADO,
      mensagem: MENSAGENS.questaoNaoEncontrada,
    });

    await expect(quizService.buscarQuestoesQuiz(filtro)).rejects.toThrow(not_nound_error);
  });

  test("Testa embaralhamento", async () => {
    const mockRepositoryResponse = { data: criarQuestoes(), total: 4 };
    repository.filtrarQuestoesQuiz.mockResolvedValue(mockRepositoryResponse);
    const questoes_quiz = converterArrayParaQuestoesQuiz(mockRepositoryResponse.data);

    const filtro = criarFiltroListarQuestoesQueryDto();

    const resultado = await quizService.buscarQuestoesQuiz(filtro);

    expect(resultado.dados).not.toEqual(questoes_quiz);
  });

  test("Testa resposta correta de questão deve retornar boolean true e a resposta correta", async () => {
    repository.registrarTentativa.mockResolvedValue(criarTentativa());
    repository.buscarResposta.mockResolvedValue(criarFeedback());
    repository.buscarSaldoMoedas.mockResolvedValue(25);

    repository.concederMoedasPorAcerto.mockResolvedValue({
      moedasConcedidas: 25,
      saldoMoedas: 25,
      moedasJaConcedidas: false,
    });

    const resultado = await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );

    expect(resultado.correcao).toBe(true);
    expect(resultado.respostaCorreta).toBe("E");
    expect(resultado.moedasConcedidas).toBe(25);
    expect(resultado.saldoMoedas).toBe(25);
  });

  test("aplica o Cafe do Foco uma vez ao acerto que concede ATP", async () => {
    const usos = criarUsoItemRepositoryMock();
    quizService = new QuizService(repository, conquistaService, usos);
    repository.registrarTentativa.mockResolvedValue(criarTentativa());
    repository.buscarResposta.mockResolvedValue(criarFeedback());
    repository.concederMoedasPorAcerto.mockResolvedValue({
      moedasConcedidas: 25,
      saldoMoedas: 25,
      moedasJaConcedidas: false,
    });
    repository.buscarSaldoMoedas.mockResolvedValue(50);
    usos.aplicarCafeNoAcerto.mockResolvedValue({
      bonusMoedas: 25,
      saldoMoedas: 50,
      uso: { itemLoja: { nome: "Café do Foco" } } as never,
    });

    const resultado = await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );

    expect(usos.aplicarCafeNoAcerto).toHaveBeenCalledWith("usuario-id", "questa-id", 25);
    expect(resultado).toMatchObject({
      moedasConcedidas: 50,
      saldoMoedas: 50,
      potencializadorAplicado: { nome: "Café do Foco", bonusMoedas: 25 },
    });
  });

  test("Testa resposta errada de questão deve retornar boolean false e a resposta correta", async () => {
    repository.registrarTentativa.mockResolvedValue(criarTentativa());
    repository.buscarResposta.mockResolvedValue(criarFeedback(AlternativaQuestao.C));

    const resultado = await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );

    expect(resultado.correcao).toBe(false);
    expect(resultado.respostaCorreta).toBe("C");
    expect(resultado.moedasConcedidas).toBe(0);
    expect(resultado.saldoMoedas).toBe(0);
    expect(repository.concederMoedasPorAcerto).not.toHaveBeenCalled();
  });

  test.each([
    [Dificuldade.FACIL, 10],
    [Dificuldade.MEDIA, 25],
    [Dificuldade.DIFICIL, 50],
  ])("deve conceder moedas conforme a dificuldade", async (dificuldade, moedas) => {
    repository.registrarTentativa.mockResolvedValue(criarTentativa());
    repository.buscarResposta.mockResolvedValue(criarFeedback(AlternativaQuestao.E, dificuldade));
    repository.buscarSaldoMoedas.mockResolvedValue(moedas);
    repository.concederMoedasPorAcerto.mockResolvedValue({
      moedasConcedidas: moedas,
      saldoMoedas: moedas,
      moedasJaConcedidas: false,
    });

    const resultado = await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );

    expect(repository.concederMoedasPorAcerto).toHaveBeenCalledWith(
      "usuario-id",
      "questa-id",
      moedas,
    );
    expect(resultado.moedasConcedidas).toBe(moedas);
    expect(resultado.saldoMoedas).toBe(moedas);
    expect(resultado.moedasJaConcedidas).toBe(false);
  });

  test("deve retornar as recompensas atomicas concedidas pelas conquistas", async () => {
    repository.registrarTentativa.mockResolvedValue(criarTentativa());

    repository.buscarResposta.mockResolvedValue(criarFeedback(AlternativaQuestao.C));

    const conquistasMock = [
      {
        conquistaId: "conquista-1",
        desbloqueioId: "desbloqueio-1",
        nome: "Primeiros passos",
        descricao: "Acerte questões",
        tier: "BRONZE",
        tipoConquista: "TOTAL_ACERTOS",
        temaId: null,
        moedasConcedidas: 30,
        saldoMoedas: 30,
        itemConcedido: null,
      },
    ];

    jest
      .spyOn(conquistaService, "processarRespostaQuestao")
      .mockResolvedValue(conquistasMock as ConquistaDesbloqueadaDto[]);

    const resultado = await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );

    expect(resultado.conquistasDesbloqueadas).toEqual(conquistasMock);
  });

  test("não deve conceder moedas por conquistas quando não houver desbloqueios", async () => {
    repository.registrarTentativa.mockResolvedValue(criarTentativa());

    repository.buscarResposta.mockResolvedValue(criarFeedback(AlternativaQuestao.C));

    jest.spyOn(conquistaService, "processarRespostaQuestao").mockResolvedValue([]);

    repository.buscarSaldoMoedas.mockResolvedValue(0);

    const resultado = await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );

    expect(resultado.conquistasDesbloqueadas).toEqual([]);
  });

  test("deve retornar conquistasDesbloqueadas como array vazio quando não houver conquistas", async () => {
    repository.registrarTentativa.mockResolvedValue(criarTentativa());

    repository.buscarResposta.mockResolvedValue(criarFeedback(AlternativaQuestao.C));

    jest.spyOn(conquistaService, "processarRespostaQuestao").mockResolvedValue([]);

    repository.buscarSaldoMoedas.mockResolvedValue(0);

    const resultado = await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );

    expect(resultado.conquistasDesbloqueadas).toEqual([]);
  });

  test("deve permitir recompensa no primeiro acerto mesmo apos erro anterior", async () => {
    repository.registrarTentativa.mockResolvedValue(criarTentativa());
    repository.buscarResposta
      .mockResolvedValueOnce(criarFeedback(AlternativaQuestao.C, Dificuldade.FACIL))
      .mockResolvedValueOnce(criarFeedback(AlternativaQuestao.E, Dificuldade.FACIL));
    repository.concederMoedasPorAcerto.mockResolvedValue({
      moedasConcedidas: 10,
      saldoMoedas: 10,
      moedasJaConcedidas: false,
    });

    await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );
    const resultadoAcerto = await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );

    expect(repository.concederMoedasPorAcerto).toHaveBeenCalledTimes(1);
    expect(resultadoAcerto.correcao).toBe(true);
    expect(resultadoAcerto.moedasConcedidas).toBe(10);
  });

  test("nao deve conceder moedas novamente para questao ja recompensada", async () => {
    repository.registrarTentativa.mockResolvedValue(criarTentativa());
    repository.buscarResposta.mockResolvedValue(
      criarFeedback(AlternativaQuestao.E, Dificuldade.DIFICIL),
    );
    repository.buscarSaldoMoedas.mockResolvedValue(50);
    repository.concederMoedasPorAcerto.mockResolvedValue({
      moedasConcedidas: 0,
      saldoMoedas: 50,
      moedasJaConcedidas: true,
    });

    const resultado = await quizService.responderQuestaoQuiz(
      criarResponderQuestaoQuizDto(),
      "usuario-id",
      PAPEIS.ALUNO,
    );

    expect(resultado.correcao).toBe(true);
    expect(resultado.moedasConcedidas).toBe(0);
    expect(resultado.saldoMoedas).toBe(50);
    expect(resultado.moedasJaConcedidas).toBe(true);
  });

  test.each([PAPEIS.PROFESSOR, PAPEIS.ADMINISTRADOR])(
    "nao deve conceder moedas para usuario com papel %s",
    async (papel) => {
      repository.registrarTentativa.mockResolvedValue(criarTentativa());
      repository.buscarResposta.mockResolvedValue(
        criarFeedback(AlternativaQuestao.E, Dificuldade.MEDIA),
      );
      repository.buscarSaldoMoedas.mockResolvedValue(0);

      const resultado = await quizService.responderQuestaoQuiz(
        criarResponderQuestaoQuizDto(),
        "usuario-id",
        papel,
      );

      expect(resultado.correcao).toBe(true);
      expect(resultado.moedasConcedidas).toBe(0);
      expect(repository.concederMoedasPorAcerto).not.toHaveBeenCalled();
    },
  );

  test("deve retornar saldo de moedas do usuario autenticado", async () => {
    repository.buscarSaldoMoedas.mockResolvedValue(75);

    const resultado = await quizService.buscarSaldoMoedas("usuario-id");

    expect(repository.buscarSaldoMoedas).toHaveBeenCalledWith("usuario-id");
    expect(resultado).toEqual({ saldoMoedas: 75 });
  });

  test("Lança erro caso id do usuário não seja informado", async () => {
    const error = new ErroAplicacao({
      codigoStatus: 401,
      codigo: CodigoDeErro.NAO_AUTORIZADO,
      mensagem: MENSAGENS.usuarioAutenticadoEncontrado,
    });

    await expect(
      quizService.responderQuestaoQuiz(criarResponderQuestaoQuizDto(), ""),
    ).rejects.toThrow(error);
  });

  test("Lança erro caso registro da tentativa falhe", async () => {
    const error = new ErroAplicacao({
      codigoStatus: 401,
      codigo: CodigoDeErro.ERRO_TENTATIVA,
      mensagem: MENSAGENS.erroTentativa,
    });
    repository.buscarResposta.mockResolvedValue(criarFeedback(AlternativaQuestao.E));
    repository.registrarTentativa.mockResolvedValue(null as unknown as ResolucaoQuestao);

    await expect(
      quizService.responderQuestaoQuiz(criarResponderQuestaoQuizDto(), "usuario-id"),
    ).rejects.toThrow(error);
  });

  test("Lança erro caso busca do gabarito falhe", async () => {
    const error = new ErroAplicacao({
      codigoStatus: 401,
      codigo: CodigoDeErro.ERRO_FEEDBACK,
      mensagem: MENSAGENS.erroFeedback,
    });

    repository.registrarTentativa.mockResolvedValue(criarTentativa());
    repository.buscarResposta.mockResolvedValue(null);

    await expect(
      quizService.responderQuestaoQuiz(criarResponderQuestaoQuizDto(), "usuario-id"),
    ).rejects.toThrow(error);
  });

  test("deve retornar a quantidade de questões agrupadas por dificuldade", async () => {
    repository.buscarQuantidadeDeQuestoesPorTema.mockResolvedValue([
      {
        nome: "Português",
        questoes: [
          { dificuldade: "FACIL" },
          { dificuldade: "FACIL" },
          { dificuldade: "MEDIA" },
          { dificuldade: "DIFICIL" },
        ],
        _count: {
          questoes: 4,
        },
      },
    ]);

    const resultado = await quizService.buscarQuantidadeDeQuestoesPorTema();

    expect(resultado).toEqual([
      {
        nome: "Português",
        totalQuestoes: 4,
        porDificuldade: {
          FACIL: 2,
          MEDIA: 1,
          DIFICIL: 1,
        },
      },
    ]);

    expect(repository.buscarQuantidadeDeQuestoesPorTema).toHaveBeenCalledTimes(1);
  });

  test("Lança erro caso busca por quantidade de questões por tema falhe", async () => {
    const error = new ErroAplicacao({
      codigoStatus: 401,
      codigo: CodigoDeErro.TEMAS_NAO_ENCONTRADOS,
      mensagem: MENSAGENS.temasNaoEncontrados,
    });

    repository.buscarQuantidadeDeQuestoesPorTema.mockResolvedValue(null);

    await expect(quizService.buscarQuantidadeDeQuestoesPorTema()).rejects.toThrow(error);
  });

  test("Lança erro caso busca por histórico falhe por usuarioId ser undefined", async () => {
    const error = new ErroAplicacao({
      codigoStatus: 401,
      codigo: CodigoDeErro.NAO_AUTORIZADO,
      mensagem: MENSAGENS.usuarioAutenticadoEncontrado,
    });

    const filtro = criarFiltroListarQuestoesQueryDto();

    await expect(quizService.buscarHistorico(undefined, filtro)).rejects.toThrow(error);
  });

  test('Lança erro caso busca por histórico falhe por usuarioId ser string ""', async () => {
    const error = new ErroAplicacao({
      codigoStatus: 401,
      codigo: CodigoDeErro.NAO_AUTORIZADO,
      mensagem: MENSAGENS.usuarioAutenticadoEncontrado,
    });

    const filtro = criarFiltroListarQuestoesQueryDto();

    await expect(quizService.buscarHistorico("", filtro)).rejects.toThrow(error);
  });

  test("deve retornar histórico vazio quando listagem de questões respondidas vier vazia", async () => {
    const filtro = criarFiltroListarQuestoesQueryDto();

    repository.listarQuestoesRespondidas.mockResolvedValue({
      data: [],
      total: 0,
    });

    const resultado = await quizService.buscarHistorico("usuarioId", filtro);

    expect(resultado).toEqual({
      dados: [],
      metadados: {
        page: 1,
        limit: 4,
        total: 0,
        totalPages: 0,
      },
    });
  });

  test("deve retornar histórico vazio quando listagem de questões respondidas vier nula", async () => {
    const filtro = criarFiltroListarQuestoesQueryDto();

    repository.listarQuestoesRespondidas.mockResolvedValue({
      data: null,
      total: null,
    });

    const resultado = await quizService.buscarHistorico("usuarioId", filtro);

    expect(resultado).toEqual({
      dados: [],
      metadados: {
        page: 1,
        limit: 4,
        total: 0,
        totalPages: 0,
      },
    });
  });

  test("deve retornar histórico corretamente para questão de múltipla escolha", async () => {
    repository.listarQuestoesRespondidas.mockResolvedValue({
      data: [
        {
          id: "resolucao-1",
          criadoEm: new Date(),
          questaoId: "questao-1",
          respostaMarcada: "A",

          questao: {
            enunciado: "Pergunta",
            tipoQuestao: "MULTIPLA_ESCOLHA",
            respostaCorreta: "A",
            saibaMais: null,
            status: "ATIVO",
            origemQuestao: "ELABORADA_POR_PROFESSOR",
            urlImagem: null,
            dificuldade: "MEDIA",

            tema: {
              id: "tema-1",
              nome: "Sistema Cardiovascular",
            },

            alternativas: {
              alternativaA: "A",
              alternativaB: "B",
              alternativaC: "C",
              alternativaD: "D",
              alternativaE: "E",
            },
          },
        },
      ],
      total: 1,
    });

    const query: FiltroListarQuestoesQueryDto = {
      tema: "t1",
      dificuldade: DIFICULDADE_API.MEDIA,
      tipo: TIPO_QUESTAO_API.MULTIPLA_ESCOLHA,
    };

    const resultado = await quizService.buscarHistorico("usuario-1", query);

    expect(resultado.dados).toHaveLength(1);

    expect(resultado.dados[0]).toMatchObject({
      questaoId: "questao-1",
      respostaMarcada: "A",
      tentativas: 1,
      distribuicao: {
        A: 1,
      },
      questao: expect.objectContaining({
        enunciado: "Pergunta",
        tipoQuestao: "MULTIPLA_ESCOLHA",
      }),
    });

    expect(resultado.metadados).toBeDefined();
    expect(repository.listarQuestoesRespondidas).toHaveBeenCalledTimes(1);
  });

  test("deve retornar histórico corretamente para questão de certo e errado", async () => {
    repository.listarQuestoesRespondidas.mockResolvedValue({
      data: [
        {
          questaoId: "questao-2",
          id: "resolucao-2",
          criadoEm: new Date(),
          respostaMarcada: "C",
          questao: {
            enunciado: "Pergunta V/F",
            tipoQuestao: "CERTO_ERRADO",
            respostaCorreta: "C",
            saibaMais: null,
            status: "ATIVO",
            origemQuestao: "ELABORADA_POR_PROFESSOR",
            urlImagem: null,
            dificuldade: "FACIL",
            tema: {
              id: "tema-2",
              nome: "Tema V/F",
            },
            alternativas: null,
          },
        },
      ],
      total: 1,
    });

    const query: FiltroListarQuestoesQueryDto = {
      tema: "tema-2",
      dificuldade: DIFICULDADE_API.FACIL,
      tipo: TIPO_QUESTAO_API.CERTO_ERRADO,
    };

    const resultado = await quizService.buscarHistorico("usuario-1", query);

    expect(resultado.dados).toHaveLength(1);

    expect(resultado.dados[0]).toMatchObject({
      questaoId: "questao-2",
      respostaMarcada: "C",
      tentativas: 1,
      distribuicao: {
        C: 1,
      },
      questao: expect.objectContaining({
        tipoQuestao: "CERTO_ERRADO",
        enunciado: "Pergunta V/F",
      }),
    });

    expect(repository.listarQuestoesRespondidas).toHaveBeenCalledTimes(1);
  });
});
