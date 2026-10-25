import { AlternativaQuestao, Prisma, StatusTentativaQuiz } from "@prisma/client";

import { prisma } from "@/config/db";
import type { ConquistaService } from "@/modules/conquistas/conquistas.service";
import { TIPO_QUESTAO_API } from "@/modules/questoes/dto/question.types";
import type { ResponderQuestaoQuizDto } from "@/modules/quiz/dto/requests/responder_questao_quiz_dto";
import { QuizRepository } from "@/modules/quiz/quiz.repository";
import { schemaResponderQuestaoQuiz } from "@/modules/quiz/quiz.schemas";
import { QuizService } from "@/modules/quiz/quiz.service";
import { MENSAGENS } from "@/shared/constants/mensagens";
import { PAPEIS } from "@/shared/constants/papeis";

jest.mock("@/config/db", () => ({
  prisma: {
    resolucaoQuestao: { create: jest.fn() },
    tentativaQuiz: { findFirst: jest.fn() },
  },
}));

const resolucaoCreate = prisma.resolucaoQuestao.create as jest.Mock;
const tentativaFindFirst = prisma.tentativaQuiz.findFirst as jest.Mock;

const respostaNaRodada: ResponderQuestaoQuizDto = {
  questaoId: "q1",
  tipo: TIPO_QUESTAO_API.MULTIPLA_ESCOLHA,
  respostaMarcada: AlternativaQuestao.B,
  tentativaId: "tentativa-1",
};

describe("Quiz - resposta dentro de uma rodada", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("schema", () => {
    it("aceita tentativaId opcional nos dois tipos de questao", () => {
      expect(schemaResponderQuestaoQuiz.safeParse(respostaNaRodada).success).toBe(true);
      expect(
        schemaResponderQuestaoQuiz.safeParse({
          questaoId: "q1",
          tipo: TIPO_QUESTAO_API.CERTO_ERRADO,
          respostaMarcada: "C",
          tentativaId: "tentativa-1",
        }).success,
      ).toBe(true);
      expect(
        schemaResponderQuestaoQuiz.safeParse({ ...respostaNaRodada, tentativaId: "" }).success,
      ).toBe(false);
    });
  });

  describe("QuizRepository", () => {
    const repository = new QuizRepository();

    it("grava o tentativaId junto da resposta", async () => {
      resolucaoCreate.mockResolvedValue({ id: "r1" });

      await repository.registrarTentativa(respostaNaRodada, "aluno-1");

      expect(resolucaoCreate).toHaveBeenCalledWith({
        data: {
          respostaMarcada: AlternativaQuestao.B,
          questaoId: "q1",
          usuarioId: "aluno-1",
          tentativaId: "tentativa-1",
        },
      });
    });

    it("converte a violacao de unicidade em 409 (questao ja respondida na rodada)", async () => {
      resolucaoCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("duplicado", {
          code: "P2002",
          clientVersion: "teste",
        }),
      );

      await expect(repository.registrarTentativa(respostaNaRodada, "aluno-1")).rejects.toMatchObject({
        codigoStatus: 409,
        message: MENSAGENS.questaoJaRespondidaNaTentativa,
      });
    });

    it("propaga erros que nao sao de unicidade", async () => {
      const erro = new Error("banco fora do ar");
      resolucaoCreate.mockRejectedValue(erro);

      await expect(repository.registrarTentativa(respostaNaRodada, "aluno-1")).rejects.toBe(erro);
    });

    it("busca a rodada do usuario com as respostas da questao informada", async () => {
      tentativaFindFirst.mockResolvedValue(null);

      await repository.buscarTentativaParaResposta("tentativa-1", "aluno-1", "q1");

      expect(tentativaFindFirst).toHaveBeenCalledWith({
        where: { id: "tentativa-1", usuarioId: "aluno-1" },
        select: {
          status: true,
          questaoIds: true,
          respostas: { where: { questaoId: "q1", excluidoEm: null }, select: { id: true } },
        },
      });
    });
  });

  describe("QuizService", () => {
    const gabarito = {
      respostaCorreta: AlternativaQuestao.B,
      saibaMais: null,
      dificuldade: "FACIL",
      temaId: "tema-1",
      tema: { id: "tema-1", nome: "Cardio" },
    };

    function criarService(tentativa: unknown) {
      const repository = {
        buscarResposta: jest.fn().mockResolvedValue(gabarito),
        buscarTentativaParaResposta: jest.fn().mockResolvedValue(tentativa),
        registrarTentativa: jest.fn().mockResolvedValue({ id: "r1" }),
        concederMoedasPorAcerto: jest
          .fn()
          .mockResolvedValue({ moedasConcedidas: 10, saldoMoedas: 10, moedasJaConcedidas: false }),
        buscarSaldoMoedas: jest.fn().mockResolvedValue(10),
      } as unknown as jest.Mocked<QuizRepository>;
      const conquistas = {
        processarRespostaQuestao: jest.fn().mockResolvedValue([]),
      } as unknown as jest.Mocked<ConquistaService>;

      return { service: new QuizService(repository, conquistas), repository, conquistas };
    }

    const rodadaAberta = {
      status: StatusTentativaQuiz.EM_ANDAMENTO,
      questaoIds: ["q1", "q2"],
      respostas: [],
    };

    it("registra a resposta quando a rodada e valida", async () => {
      const { service, repository } = criarService(rodadaAberta);

      const feedback = await service.responderQuestaoQuiz(respostaNaRodada, "aluno-1", PAPEIS.ALUNO);

      expect(repository.buscarTentativaParaResposta).toHaveBeenCalledWith(
        "tentativa-1",
        "aluno-1",
        "q1",
      );
      expect(repository.registrarTentativa).toHaveBeenCalledWith(respostaNaRodada, "aluno-1", true);
      expect(feedback.correcao).toBe(true);
    });

    it("nao consulta rodada quando a resposta e avulsa", async () => {
      const { service, repository } = criarService(rodadaAberta);
      const respostaAvulsa: ResponderQuestaoQuizDto = {
        questaoId: respostaNaRodada.questaoId,
        tipo: respostaNaRodada.tipo,
        respostaMarcada: respostaNaRodada.respostaMarcada,
      };

      await service.responderQuestaoQuiz(respostaAvulsa, "aluno-1", PAPEIS.ALUNO);

      expect(repository.buscarTentativaParaResposta).not.toHaveBeenCalled();
      expect(repository.registrarTentativa).toHaveBeenCalled();
    });

    it.each([
      ["rodada inexistente", null, 404, MENSAGENS.tentativaNaoEncontrada],
      [
        "rodada ja concluida",
        { ...rodadaAberta, status: StatusTentativaQuiz.CONCLUIDA },
        409,
        MENSAGENS.tentativaJaConcluida,
      ],
      [
        "questao fora da rodada",
        { ...rodadaAberta, questaoIds: ["q9"] },
        400,
        MENSAGENS.questaoForaDaTentativa,
      ],
      [
        "questao ja respondida na rodada",
        { ...rodadaAberta, respostas: [{ id: "r0" }] },
        409,
        MENSAGENS.questaoJaRespondidaNaTentativa,
      ],
    ])("recusa a resposta: %s", async (_caso, tentativa, status, mensagem) => {
      const { service, repository, conquistas } = criarService(tentativa);

      await expect(
        service.responderQuestaoQuiz(respostaNaRodada, "aluno-1", PAPEIS.ALUNO),
      ).rejects.toMatchObject({ codigoStatus: status, message: mensagem });

      // Nada e gravado nem premiado quando a rodada rejeita a resposta.
      expect(repository.registrarTentativa).not.toHaveBeenCalled();
      expect(repository.concederMoedasPorAcerto).not.toHaveBeenCalled();
      expect(conquistas.processarRespostaQuestao).not.toHaveBeenCalled();
    });
  });
});
