import request from "supertest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import { AlternativaQuestao, Dificuldade, StatusQuestao, TipoQuestao } from "@prisma/client";

import { prisma } from "@/config/db";
import type {
  HistoricoXpItemDto,
  ProgressoNivelDto,
  ResultadoTentativaDto,
  TentativaIniciadaDto,
} from "@/modules/progressao/progressao.types";
import { TIPO_QUESTAO_API } from "@/modules/questoes/dto/question.types";
import { quizRouter } from "@/modules/quiz/quiz.routes";
import { middlewareTratamentoErros } from "@/shared/middlewares/tratamento-erros.middleware";
import type { RespostaPaginada } from "@/shared/types/api.types";

interface AuthenticatedRequest extends Request {
  usuario?: { id: string; papel: string };
}

jest.mock("@/shared/middlewares/papeis.middleware", () => ({
  middlewarePapeis: () => (req: Request, _res: Response, next: NextFunction) => {
    (req as AuthenticatedRequest).usuario = { id: "aluno-xp", papel: "ALUNO" };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use("/api/v1/quiz", quizRouter);
app.use(middlewareTratamentoErros);

describe("Testes de Integração - Progressão (rodada de quiz e XP)", () => {
  const limparBanco = async () => {
    // Ordem estrita para evitar violação de chaves estrangeiras
    await prisma.transacaoXp.deleteMany();
    await prisma.progressoXp.deleteMany();
    await prisma.eventoMissao.deleteMany();
    await prisma.missaoUsuario.deleteMany();
    await prisma.periodoMissoes.deleteMany();
    await prisma.transacaoMoeda.deleteMany();
    await prisma.resolucaoQuestao.deleteMany();
    await prisma.tentativaQuiz.deleteMany();
    await prisma.carteiraMoedas.deleteMany();
    await prisma.conquistaUsuario.deleteMany();
    await prisma.desbloqueioConquista.deleteMany();
    await prisma.recompensaItemConquista.deleteMany();
    await prisma.conquista.deleteMany();
    await prisma.questaoAlternativa.deleteMany();
    await prisma.questao.deleteMany();
    await prisma.tema.deleteMany();
  };

  // Cria um tema com N questoes faceis cuja resposta correta e sempre "A".
  const criarQuestoes = async (quantidade: number) => {
    const tema = await prisma.tema.create({ data: { nome: "Abdome Agudo" } });

    for (let indice = 0; indice < quantidade; indice++) {
      await prisma.questao.create({
        data: {
          enunciado: `Questao ${indice + 1}`,
          tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA,
          respostaCorreta: AlternativaQuestao.A,
          dificuldade: Dificuldade.FACIL,
          temaId: tema.id,
          criadoPorId: "prof-123",
          status: StatusQuestao.ATIVO,
          alternativas: {
            create: {
              alternativaA: "A",
              alternativaB: "B",
              alternativaC: "C",
              alternativaD: "D",
              alternativaE: "E",
            },
          },
        },
      });
    }
  };

  const iniciar = async () => {
    const resposta = await request(app)
      .post("/api/v1/quiz/tentativas")
      .send({ tema: "Abdome Agudo", dificuldade: Dificuldade.FACIL });

    return { status: resposta.status, body: resposta.body as TentativaIniciadaDto };
  };

  const responder = async (tentativaId: string, questaoId: string, alternativa: AlternativaQuestao) =>
    await request(app).post("/api/v1/quiz/responder").send({
      questaoId,
      tipo: TIPO_QUESTAO_API.MULTIPLA_ESCOLHA,
      respostaMarcada: alternativa,
      tentativaId,
    });

  beforeEach(async () => {
    await limparBanco();
  });

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect();
  });

  it("monta a rodada com todas as questões quando há menos de 10", async () => {
    await criarQuestoes(4);

    const { status, body } = await iniciar();

    expect(status).toBe(201);
    expect(body.totalQuestoes).toBe(4);
    expect(new Set(body.questoes.map((questao) => questao.id)).size).toBe(4);
  });

  it("limita a rodada a 10 questões", async () => {
    await criarQuestoes(12);

    const { body } = await iniciar();

    expect(body.totalQuestoes).toBe(10);
    expect(body.questoes).toHaveLength(10);
  });

  it("concede XP ao concluir e não concede de novo na mesma rodada", async () => {
    await criarQuestoes(4);
    const { body: tentativa } = await iniciar();

    // Acerta 3 e erra a ultima.
    for (const [indice, questao] of tentativa.questoes.entries()) {
      const alternativa = indice < 3 ? AlternativaQuestao.A : AlternativaQuestao.B;
      const resposta = await responder(tentativa.tentativaId, questao.id, alternativa);
      expect(resposta.status).toBe(200);
    }

    const primeira = await request(app).post(
      `/api/v1/quiz/tentativas/${tentativa.tentativaId}/concluir`,
    );
    const resultado = primeira.body as ResultadoTentativaDto;

    expect(primeira.status).toBe(200);
    expect(resultado.jaConcluida).toBe(false);
    expect(resultado.totalAcertos).toBe(3);
    // 4 questoes x 5 de base + 3 acertos faceis x 5 de bonus.
    expect(resultado.recompensa).toEqual({
      xpBase: 20,
      bonusDesempenho: 15,
      bonusPowerUp: 0,
      xpTotalRecebido: 35,
    });
    expect(resultado.progresso.xpTotal).toBe(35);
    expect(resultado.progresso.nivel).toBe(1);

    // Repeticao (refresh/nova requisicao): mesmo resultado, sem XP novo.
    const segunda = await request(app).post(
      `/api/v1/quiz/tentativas/${tentativa.tentativaId}/concluir`,
    );
    const repetido = segunda.body as ResultadoTentativaDto;

    expect(segunda.status).toBe(200);
    expect(repetido.jaConcluida).toBe(true);
    expect(repetido.recompensa.xpTotalRecebido).toBe(35);
    expect(repetido.progresso.xpTotal).toBe(35);

    const progresso = await prisma.progressoXp.findUnique({ where: { usuarioId: "aluno-xp" } });
    expect(progresso?.xpTotal).toBe(35);
    expect(await prisma.transacaoXp.count()).toBe(1);

    const consultaProgresso = await request(app).get("/api/v1/quiz/progresso");
    expect((consultaProgresso.body as ProgressoNivelDto).xpFaltante).toBe(65);

    const historico = await request(app).get("/api/v1/quiz/xp/historico");
    const itens = (historico.body as RespostaPaginada<HistoricoXpItemDto>).dados;
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({
      origem: "QUIZ_CONCLUIDO",
      valor: 35,
      quiz: { tentativaId: tentativa.tentativaId, tema: "Abdome Agudo", totalQuestoes: 4, totalAcertos: 3 },
    });
  });

  it("recusa concluir com questões pendentes e responder a mesma questão duas vezes", async () => {
    await criarQuestoes(2);
    const { body: tentativa } = await iniciar();
    const [primeiraQuestao] = tentativa.questoes;

    await responder(tentativa.tentativaId, primeiraQuestao.id, AlternativaQuestao.A);

    const repetida = await responder(tentativa.tentativaId, primeiraQuestao.id, AlternativaQuestao.A);
    expect(repetida.status).toBe(409);

    const incompleta = await request(app).post(
      `/api/v1/quiz/tentativas/${tentativa.tentativaId}/concluir`,
    );
    expect(incompleta.status).toBe(409);
    expect(await prisma.transacaoXp.count()).toBe(0);
  });

  it("retorna 404 ao concluir uma rodada inexistente", async () => {
    const resposta = await request(app).post("/api/v1/quiz/tentativas/nao-existe/concluir");

    expect(resposta.status).toBe(404);
  });
});
