import { EloXp, StatusTentativaQuiz } from "@prisma/client";

import type {
  ProgressaoRepository,
  TentativaParaConclusao,
  TransacaoXpComTentativa,
} from "@/modules/progressao/progressao.repository";
import { ProgressaoService } from "@/modules/progressao/progressao.service";
import type { RegistroQuestaoCompleta } from "@/modules/questoes/dto/question.types";
import { MENSAGENS } from "@/shared/constants/mensagens";
import { PAPEIS } from "@/shared/constants/papeis";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";

const agora = new Date("2026-10-09T12:00:00.000Z");

function criarQuestao(id: string): RegistroQuestaoCompleta {
  return {
    id,
    enunciado: `Enunciado ${id}`,
    tipoQuestao: "MULTIPLA_ESCOLHA",
    respostaCorreta: "B",
    saibaMais: null,
    status: "ATIVO",
    origemQuestao: "ELABORADA_POR_PROFESSOR",
    taxonomiaBloom: null,
    regiaoAnatomica: null,
    urlImagem: null,
    criadoPorId: "professor-1",
    temaId: "tema-1",
    questaoOriginalId: null,
    dificuldade: "FACIL",
    criadoEm: agora,
    atualizadoEm: agora,
    excluidoEm: null,
    tema: { id: "tema-1", nome: "Abdome Agudo", criadoEm: agora, atualizadoEm: agora, excluidoEm: null },
    alternativas: null,
  } as unknown as RegistroQuestaoCompleta;
}

type RespostaDaTentativa = TentativaParaConclusao["respostas"][number];

function criarResposta(
  questaoId: string,
  acertou: boolean,
  dificuldade: "FACIL" | "MEDIA" | "DIFICIL" = "FACIL",
): RespostaDaTentativa {
  return {
    questaoId,
    respostaMarcada: acertou ? "B" : "A",
    questao: { respostaCorreta: "B", dificuldade },
  };
}

function criarTentativa(parcial: Partial<TentativaParaConclusao> = {}): TentativaParaConclusao {
  return {
    id: "tentativa-1",
    usuarioId: "aluno-1",
    tema: "Abdome Agudo",
    dificuldade: "FACIL",
    questaoIds: ["q1", "q2", "q3", "q4"],
    totalQuestoes: 4,
    totalAcertos: null,
    status: StatusTentativaQuiz.EM_ANDAMENTO,
    iniciadaEm: agora,
    concluidaEm: null,
    respostas: [],
    transacaoXp: null,
    ...parcial,
  };
}

function criarTransacao(parcial: Partial<TransacaoXpComTentativa> = {}): TransacaoXpComTentativa {
  return {
    id: "xp-1",
    usuarioId: "aluno-1",
    tentativaId: "tentativa-1",
    origem: "QUIZ_CONCLUIDO",
    xpBase: 20,
    bonusDesempenho: 15,
    bonusPowerUp: 0,
    quantidade: 35,
    xpTotalApos: 35,
    criadoEm: agora,
    tentativa: {
      id: "tentativa-1",
      tema: "Abdome Agudo",
      dificuldade: "FACIL",
      totalQuestoes: 4,
      totalAcertos: 3,
    },
    ...parcial,
  };
}

function criarRepositoryMock() {
  return {
    listarIdsQuestoesDisponiveis: jest.fn(),
    buscarQuestoesPorIds: jest.fn(),
    criarTentativa: jest.fn(),
    buscarTentativaParaConclusao: jest.fn(),
    concluirTentativa: jest.fn(),
    buscarXpTotal: jest.fn(),
    buscarDadosProgresso: jest.fn(),
    listarHistoricoXp: jest.fn(),
  } as unknown as jest.Mocked<ProgressaoRepository>;
}

describe("ProgressaoService", () => {
  let repository: jest.Mocked<ProgressaoRepository>;
  let service: ProgressaoService;

  beforeEach(() => {
    repository = criarRepositoryMock();
    service = new ProgressaoService(repository);
    repository.criarTentativa.mockImplementation(async (usuarioId, filtros, questaoIds) => ({
      id: "tentativa-1",
      usuarioId,
      tema: filtros.tema,
      dificuldade: filtros.dificuldade,
      questaoIds,
      totalQuestoes: questaoIds.length,
      totalAcertos: null,
      status: StatusTentativaQuiz.EM_ANDAMENTO,
      iniciadaEm: agora,
      concluidaEm: null,
    }));
  });

  describe("iniciarTentativa", () => {
    it("usa todas as questoes quando ha menos que o limite (rodada de 4)", async () => {
      const ids = ["q1", "q2", "q3", "q4"];
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue(ids);
      repository.buscarQuestoesPorIds.mockImplementation(async (pedidos) => pedidos.map(criarQuestao));

      const resultado = await service.iniciarTentativa(
        { tema: "Abdome Agudo", dificuldade: "FACIL" },
        "aluno-1",
      );

      expect(resultado.tentativaId).toBe("tentativa-1");
      expect(resultado.totalQuestoes).toBe(4);
      expect(resultado.questoes.map((questao) => questao.id).sort()).toEqual(ids);
      expect(repository.criarTentativa).toHaveBeenCalledWith(
        "aluno-1",
        { tema: "Abdome Agudo", dificuldade: "FACIL" },
        expect.arrayContaining(ids),
      );
    });

    it("limita a rodada a 10 questoes sem repetir nenhuma", async () => {
      const ids = Array.from({ length: 25 }, (_, indice) => `q${indice + 1}`);
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue(ids);
      repository.buscarQuestoesPorIds.mockImplementation(async (pedidos) => pedidos.map(criarQuestao));

      const resultado = await service.iniciarTentativa({}, "aluno-1");

      const idsDaRodada = resultado.questoes.map((questao) => questao.id);
      expect(resultado.totalQuestoes).toBe(10);
      expect(new Set(idsDaRodada).size).toBe(10);
      expect(repository.criarTentativa).toHaveBeenCalledWith(
        "aluno-1",
        { tema: null, dificuldade: null },
        idsDaRodada,
      );
    });

    it("mantem a ordem sorteada mesmo que o banco devolva em outra ordem", async () => {
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue(["q1", "q2", "q3"]);
      repository.buscarQuestoesPorIds.mockImplementation(async (pedidos) =>
        [...pedidos].reverse().map(criarQuestao),
      );

      const resultado = await service.iniciarTentativa({}, "aluno-1");

      const idsGravados = repository.criarTentativa.mock.calls[0][2];
      expect(resultado.questoes.map((questao) => questao.id)).toEqual(idsGravados);
    });

    it("descarta ids sorteados que nao voltaram do banco", async () => {
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue(["q1", "q2"]);
      repository.buscarQuestoesPorIds.mockResolvedValue([criarQuestao("q2")]);

      const resultado = await service.iniciarTentativa({}, "aluno-1");

      expect(resultado.totalQuestoes).toBe(1);
      expect(resultado.questoes[0].id).toBe("q2");
    });

    it("retorna 404 quando nao ha questoes para o filtro", async () => {
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue([]);

      await expect(service.iniciarTentativa({ tema: "Vazio" }, "aluno-1")).rejects.toMatchObject({
        codigoStatus: 404,
        codigo: CodigoDeErro.NAO_ENCONTRADO,
      });
      expect(repository.criarTentativa).not.toHaveBeenCalled();
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.iniciarTentativa({}, "")).rejects.toMatchObject({ codigoStatus: 401 });
    });
  });

  describe("concluirTentativa", () => {
    const respostasCompletas = [
      criarResposta("q1", true),
      criarResposta("q2", true),
      criarResposta("q3", true),
      criarResposta("q4", false),
    ];

    it("conta os acertos no servidor, credita o XP e devolve o resumo", async () => {
      repository.buscarTentativaParaConclusao
        .mockResolvedValueOnce(criarTentativa({ respostas: respostasCompletas }))
        .mockResolvedValueOnce(
          criarTentativa({
            respostas: respostasCompletas,
            status: StatusTentativaQuiz.CONCLUIDA,
            totalAcertos: 3,
            transacaoXp: criarTransacao(),
          }),
        );
      repository.concluirTentativa.mockResolvedValue({ concluidaAgora: true });
      repository.buscarDadosProgresso.mockResolvedValue({ xpTotal: 35, maiorElo: EloXp.CURIOSO });

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(repository.concluirTentativa).toHaveBeenCalledWith({
        tentativaId: "tentativa-1",
        usuarioId: "aluno-1",
        totalAcertos: 3,
        recompensa: { xpBase: 20, bonusDesempenho: 15, bonusPowerUp: 0, xpTotalRecebido: 35 },
      });
      expect(resultado).toMatchObject({
        tentativaId: "tentativa-1",
        tema: "Abdome Agudo",
        dificuldade: "FACIL",
        totalQuestoes: 4,
        totalAcertos: 3,
        jaConcluida: false,
        recompensa: { xpBase: 20, bonusDesempenho: 15, bonusPowerUp: 0, xpTotalRecebido: 35 },
        progresso: {
          xpTotal: 35,
          nivel: 1,
          proximoNivel: 2,
          xpNoNivel: 35,
          xpNecessarioNoNivel: 100,
          xpFaltante: 65,
          percentual: 35,
        },
        subiuDeNivel: false,
        nivelAnterior: 1,
        subiuDeElo: false,
        xpExcedenteElo: 35,
      });
      expect(resultado.eloAnterior.nome).toBe("Curioso");
      expect(resultado.novoElo.nome).toBe("Curioso");
    });

    it("sinaliza a subida de nivel e subida de elo quando o XP cruza a fronteira (490 -> 510)", async () => {
      const transacao = criarTransacao({ quantidade: 20, xpTotalApos: 510 });
      repository.buscarTentativaParaConclusao
        .mockResolvedValueOnce(criarTentativa({ respostas: respostasCompletas }))
        .mockResolvedValueOnce(
          criarTentativa({
            status: StatusTentativaQuiz.CONCLUIDA,
            totalAcertos: 3,
            transacaoXp: transacao,
          }),
        );
      repository.concluirTentativa.mockResolvedValue({ concluidaAgora: true });
      repository.buscarDadosProgresso.mockResolvedValue({ xpTotal: 510, maiorElo: EloXp.ACADEMICO });

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(resultado.subiuDeElo).toBe(true);
      expect(resultado.eloAnterior.nome).toBe("Curioso");
      expect(resultado.novoElo.nome).toBe("Acadêmico");
      expect(resultado.xpExcedenteElo).toBe(10);
      expect(resultado.progresso.eloAtual.nome).toBe("Acadêmico");
      expect(resultado.progresso.xpFaltanteProximoElo).toBe(990);
    });

    it("nao credita de novo quando a rodada ja estava concluida (refresh/nova requisicao)", async () => {
      repository.buscarTentativaParaConclusao.mockResolvedValue(
        criarTentativa({
          status: StatusTentativaQuiz.CONCLUIDA,
          totalAcertos: 3,
          transacaoXp: criarTransacao(),
        }),
      );
      repository.buscarDadosProgresso.mockResolvedValue({ xpTotal: 35, maiorElo: EloXp.CURIOSO });

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(repository.concluirTentativa).not.toHaveBeenCalled();
      expect(resultado.jaConcluida).toBe(true);
      expect(resultado.recompensa.xpTotalRecebido).toBe(35);
      expect(resultado.totalAcertos).toBe(3);
    });

    it("marca jaConcluida quando uma requisicao concorrente concluiu primeiro", async () => {
      repository.buscarTentativaParaConclusao
        .mockResolvedValueOnce(criarTentativa({ respostas: respostasCompletas }))
        .mockResolvedValueOnce(
          criarTentativa({
            status: StatusTentativaQuiz.CONCLUIDA,
            totalAcertos: 3,
            transacaoXp: criarTransacao(),
          }),
        );
      repository.concluirTentativa.mockResolvedValue({ concluidaAgora: false });
      repository.buscarDadosProgresso.mockResolvedValue({ xpTotal: 35, maiorElo: EloXp.CURIOSO });

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(resultado.jaConcluida).toBe(true);
      expect(resultado.recompensa.xpTotalRecebido).toBe(35);
    });

    it("conclui sem XP quando o usuario nao e aluno", async () => {
      repository.buscarTentativaParaConclusao
        .mockResolvedValueOnce(criarTentativa({ respostas: respostasCompletas }))
        .mockResolvedValueOnce(
          criarTentativa({ status: StatusTentativaQuiz.CONCLUIDA, totalAcertos: 3 }),
        );
      repository.concluirTentativa.mockResolvedValue({ concluidaAgora: true });
      repository.buscarDadosProgresso.mockResolvedValue({ xpTotal: 0, maiorElo: EloXp.CURIOSO });

      const resultado = await service.concluirTentativa("tentativa-1", "prof-1", PAPEIS.PROFESSOR);

      expect(repository.concluirTentativa).toHaveBeenCalledWith(
        expect.objectContaining({ recompensa: null, totalAcertos: 3 }),
      );
      expect(resultado.recompensa).toEqual({
        xpBase: 0,
        bonusDesempenho: 0,
        bonusPowerUp: 0,
        xpTotalRecebido: 0,
      });
      expect(resultado.subiuDeNivel).toBe(false);
      expect(resultado.subiuDeElo).toBe(false);
    });

    it("recusa concluir com questoes pendentes", async () => {
      repository.buscarTentativaParaConclusao.mockResolvedValue(
        criarTentativa({ respostas: [criarResposta("q1", true)] }),
      );

      await expect(
        service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO),
      ).rejects.toMatchObject({
        codigoStatus: 409,
        codigo: CodigoDeErro.CONFLITO,
        message: MENSAGENS.tentativaIncompleta,
        detalhes: { respondidas: 1, totalQuestoes: 4 },
      });
      expect(repository.concluirTentativa).not.toHaveBeenCalled();
    });

    it("retorna 404 para rodada inexistente ou de outro usuario", async () => {
      repository.buscarTentativaParaConclusao.mockResolvedValue(null);

      await expect(
        service.concluirTentativa("nao-existe", "aluno-1", PAPEIS.ALUNO),
      ).rejects.toMatchObject({ codigoStatus: 404, message: MENSAGENS.tentativaNaoEncontrada });
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.concluirTentativa("tentativa-1", "")).rejects.toMatchObject({
        codigoStatus: 401,
      });
    });

    it("trata totalAcertos ausente como zero no resumo", async () => {
      repository.buscarTentativaParaConclusao.mockResolvedValue(
        criarTentativa({ status: StatusTentativaQuiz.CONCLUIDA, totalAcertos: null }),
      );
      repository.buscarDadosProgresso.mockResolvedValue({ xpTotal: 0, maiorElo: EloXp.CURIOSO });

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(resultado.totalAcertos).toBe(0);
    });
  });

  describe("buscarProgresso", () => {
    it("devolve nivel, elo e XP faltante a partir do XP acumulado", async () => {
      repository.buscarDadosProgresso.mockResolvedValue({ xpTotal: 1200, maiorElo: EloXp.ACADEMICO });

      await expect(service.buscarProgresso("aluno-1")).resolves.toMatchObject({
        xpTotal: 1200,
        eloAtual: expect.objectContaining({ nome: "Acadêmico" }),
        proximoElo: expect.objectContaining({ nome: "Interno" }),
        xpFaltanteProximoElo: 300,
      });
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.buscarProgresso("")).rejects.toMatchObject({ codigoStatus: 401 });
    });
  });

  describe("buscarHistoricoXp", () => {
    it("mapeia data, origem, quiz relacionado e valor", async () => {
      repository.listarHistoricoXp.mockResolvedValue({
        data: [
          criarTransacao(),
          criarTransacao({ id: "xp-2", tentativaId: null, tentativa: null }),
          criarTransacao({
            id: "xp-3",
            tentativa: {
              id: "tentativa-3",
              tema: null,
              dificuldade: null,
              totalQuestoes: 2,
              totalAcertos: null,
            },
          }),
        ],
        total: 3,
      });

      const resultado = await service.buscarHistoricoXp("aluno-1", { page: 1, limit: 10 });

      expect(repository.listarHistoricoXp).toHaveBeenCalledWith("aluno-1", {
        page: 1,
        limit: 10,
        skip: 0,
      });
      expect(resultado.dados[0]).toEqual({
        id: "xp-1",
        data: "2026-10-09T12:00:00.000Z",
        origem: "QUIZ_CONCLUIDO",
        quiz: {
          tentativaId: "tentativa-1",
          tema: "Abdome Agudo",
          dificuldade: "FACIL",
          totalQuestoes: 4,
          totalAcertos: 3,
        },
        xpBase: 20,
        bonusDesempenho: 15,
        bonusPowerUp: 0,
        valor: 35,
      });
      expect(resultado.dados[1].quiz).toBeNull();
      expect(resultado.dados[2].quiz?.totalAcertos).toBe(0);
      expect(resultado.metadados).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.buscarHistoricoXp("", {})).rejects.toMatchObject({ codigoStatus: 401 });
    });
  });
});
