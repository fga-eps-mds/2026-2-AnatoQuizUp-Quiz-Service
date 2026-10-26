import type { NextFunction, Request, Response } from "express";
import express from "express";
import request from "supertest";

import { prisma } from "@/config/db";
import { quizRouter } from "@/modules/quiz/quiz.routes";
import type {
  ConfiguracaoInatividadeDto,
  ProgressoNivelDto,
  ResultadoVerificacaoInatividadeDto,
} from "@/modules/progressao/progressao.types";
import { middlewareTratamentoErros } from "@/shared/middlewares/tratamento-erros.middleware";

// Diferente dos outros testes de integracao, aqui o middleware de papeis NAO e mockado:
// a US exige que a configuracao dos prazos e a rotina de inatividade sejam negadas a quem
// nao tem papel administrativo, e isso so pode ser verificado com a checagem real.
let usuarioAtual = { id: "aluno-inatividade", papel: "ALUNO" };

const app = express();
app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as Request & { usuario?: typeof usuarioAtual }).usuario = usuarioAtual;
  next();
});
app.use("/api/v1/quiz", quizRouter);
app.use(middlewareTratamentoErros);

const DIA = 24 * 60 * 60 * 1000;

const comoAluno = () => {
  usuarioAtual = { id: "aluno-inatividade", papel: "ALUNO" };
};

const comoAdministrador = () => {
  usuarioAtual = { id: "admin-1", papel: "ADMINISTRADOR" };
};

const limparBanco = async () => {
  await prisma.notificacaoElo.deleteMany();
  await prisma.eventoElo.deleteMany();
  await prisma.transacaoXp.deleteMany();
  await prisma.progressoXp.deleteMany();
  await prisma.configuracaoInatividade.deleteMany();
};

// Aluno no elo R3 com `dias` sem atividade valida.
const criarAlunoInativo = async (usuarioId: string, dias: number) =>
  await prisma.progressoXp.create({
    data: {
      usuarioId,
      xpTotal: 7000,
      xpElo: 7000,
      eloAtual: "R3",
      maiorElo: "R3",
      ultimaAtividadeEm: new Date(Date.now() - dias * DIA),
    },
  });

describe("Testes de Integração - Inatividade e configuração de elo", () => {
  beforeEach(async () => {
    await limparBanco();
    comoAluno();
  });

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect();
  });

  describe("configuração dos períodos de inatividade", () => {
    it("nega leitura e alteração para quem não tem papel administrativo", async () => {
      const leitura = await request(app).get("/api/v1/quiz/progressao/configuracao");
      expect(leitura.status).toBe(403);

      const alteracao = await request(app).put("/api/v1/quiz/progressao/configuracao").send({
        diasAviso: 1,
        diasRisco: 2,
        diasRebaixamento: 3,
        diasEntreRebaixamentos: 4,
      });
      expect(alteracao.status).toBe(403);
      expect(await prisma.configuracaoInatividade.count()).toBe(0);
    });

    it("entrega os padrões da US e permite ao administrador alterar os prazos", async () => {
      comoAdministrador();

      const leitura = await request(app).get("/api/v1/quiz/progressao/configuracao");
      expect(leitura.status).toBe(200);
      expect(leitura.body as ConfiguracaoInatividadeDto).toMatchObject({
        diasAviso: 7,
        diasRisco: 8,
        diasRebaixamento: 9,
        diasEntreRebaixamentos: 14,
        indisponibilidades: [],
      });

      const alteracao = await request(app)
        .put("/api/v1/quiz/progressao/configuracao")
        .send({
          diasAviso: 20,
          diasRisco: 25,
          diasRebaixamento: 30,
          diasEntreRebaixamentos: 15,
          indisponibilidades: [
            { inicio: "2026-10-01T00:00:00.000Z", fim: "2026-10-03T00:00:00.000Z" },
          ],
        });

      expect(alteracao.status).toBe(200);
      expect(alteracao.body as ConfiguracaoInatividadeDto).toMatchObject({
        diasAviso: 20,
        diasRebaixamento: 30,
        atualizadoPorId: "admin-1",
      });
    });

    it("rejeita prazos fora de ordem", async () => {
      comoAdministrador();

      const resposta = await request(app).put("/api/v1/quiz/progressao/configuracao").send({
        diasAviso: 10,
        diasRisco: 9,
        diasRebaixamento: 30,
        diasEntreRebaixamentos: 15,
      });

      expect(resposta.status).toBe(400);
    });

    it("passa a valer para o cálculo do estado do elo", async () => {
      await criarAlunoInativo("aluno-inatividade", 9);

      comoAdministrador();
      await request(app).put("/api/v1/quiz/progressao/configuracao").send({
        diasAviso: 20,
        diasRisco: 25,
        diasRebaixamento: 30,
        diasEntreRebaixamentos: 15,
      });

      comoAluno();
      const progresso = await request(app).get("/api/v1/quiz/progresso");

      // Com o prazo esticado para 30 dias, 9 dias de inatividade não rebaixam ninguém.
      expect((progresso.body as ProgressoNivelDto).estadoElo).toBe("ATIVO");
      expect((progresso.body as ProgressoNivelDto).eloAtual.codigo).toBe("R3");
    });
  });

  describe("rotina de verificação de inatividade", () => {
    it("nega a execução para quem não tem papel administrativo", async () => {
      await criarAlunoInativo("aluno-inatividade", 9);

      const resposta = await request(app).post("/api/v1/quiz/progressao/inatividade/verificar");

      expect(resposta.status).toBe(403);
      const progresso = await prisma.progressoXp.findUniqueOrThrow({
        where: { usuarioId: "aluno-inatividade" },
      });
      expect(progresso.eloAtual).toBe("R3");
    });

    it("rebaixa em lote apenas quem passou do prazo, sem receber identificador de usuário", async () => {
      await criarAlunoInativo("aluno-inativo", 9);
      await criarAlunoInativo("aluno-em-dia", 1);

      comoAdministrador();
      const resposta = await request(app).post("/api/v1/quiz/progressao/inatividade/verificar");

      expect(resposta.status).toBe(200);
      expect(resposta.body as ResultadoVerificacaoInatividadeDto).toMatchObject({
        avaliados: 1,
        rebaixamentos: 1,
        pendentes: false,
      });

      const rebaixado = await prisma.progressoXp.findUniqueOrThrow({
        where: { usuarioId: "aluno-inativo" },
      });
      expect(rebaixado.eloAtual).toBe("R1");
      expect(rebaixado.xpElo).toBe(5999);
      // XP total histórico e maior elo permanecem intactos.
      expect(rebaixado.xpTotal).toBe(7000);
      expect(rebaixado.maiorElo).toBe("R3");

      const emDia = await prisma.progressoXp.findUniqueOrThrow({
        where: { usuarioId: "aluno-em-dia" },
      });
      expect(emDia.eloAtual).toBe("R3");
      expect(emDia.xpElo).toBe(7000);
    });

    it("é idempotente: reexecutar no mesmo dia não rebaixa de novo", async () => {
      await criarAlunoInativo("aluno-inativo", 9);

      comoAdministrador();
      await request(app).post("/api/v1/quiz/progressao/inatividade/verificar");
      const segunda = await request(app).post("/api/v1/quiz/progressao/inatividade/verificar");

      expect((segunda.body as ResultadoVerificacaoInatividadeDto).rebaixamentos).toBe(0);
      expect(await prisma.eventoElo.count({ where: { tipo: "REBAIXAMENTO" } })).toBe(1);
      // Os avisos também não se repetem (deduplicação pela chave do ciclo).
      expect(await prisma.notificacaoElo.count({ where: { tipo: "ELO_REBAIXADO" } })).toBe(1);
    });

    it("aplica a cascata de 14 dias e para no piso do elo Curioso", async () => {
      await criarAlunoInativo("aluno-abandonado", 9 + 14 * 10);

      comoAdministrador();
      await request(app).post("/api/v1/quiz/progressao/inatividade/verificar");

      const progresso = await prisma.progressoXp.findUniqueOrThrow({
        where: { usuarioId: "aluno-abandonado" },
      });

      expect(progresso.eloAtual).toBe("CURIOSO");
      expect(progresso.xpTotal).toBe(7000);
      expect(progresso.maiorElo).toBe("R3");
    });

    it("não penaliza nem avisa quem já está no piso do elo Curioso", async () => {
      await prisma.progressoXp.create({
        data: {
          usuarioId: "aluno-curioso",
          xpTotal: 7000,
          xpElo: 120,
          eloAtual: "CURIOSO",
          maiorElo: "R3",
          ultimaAtividadeEm: new Date(Date.now() - 60 * DIA),
        },
      });

      comoAdministrador();
      await request(app).post("/api/v1/quiz/progressao/inatividade/verificar");

      const progresso = await prisma.progressoXp.findUniqueOrThrow({
        where: { usuarioId: "aluno-curioso" },
      });

      expect(progresso.eloAtual).toBe("CURIOSO");
      expect(progresso.xpElo).toBe(120);
      expect(await prisma.notificacaoElo.count({ where: { usuarioId: "aluno-curioso" } })).toBe(0);
      expect(await prisma.eventoElo.count({ where: { usuarioId: "aluno-curioso" } })).toBe(0);
    });

    it("gera apenas o aviso preventivo para quem ainda está dentro do prazo", async () => {
      await criarAlunoInativo("aluno-avisado", 7);

      comoAdministrador();
      const resposta = await request(app).post("/api/v1/quiz/progressao/inatividade/verificar");

      expect((resposta.body as ResultadoVerificacaoInatividadeDto).rebaixamentos).toBe(0);
      const avisos = await prisma.notificacaoElo.findMany({
        where: { usuarioId: "aluno-avisado" },
      });
      expect(avisos.map((aviso) => aviso.tipo)).toEqual(["AVISO_PREVENTIVO"]);
    });
  });

  describe("isolamento entre estudantes", () => {
    it("não entrega as notificações nem o histórico de elo de outro aluno", async () => {
      await criarAlunoInativo("aluno-inatividade", 9);
      await criarAlunoInativo("outro-aluno", 9);

      comoAdministrador();
      await request(app).post("/api/v1/quiz/progressao/inatividade/verificar");

      comoAluno();
      const avisos = await request(app).get("/api/v1/quiz/progressao/notificacoes");
      const historico = await request(app).get("/api/v1/quiz/progressao/elo/historico");

      expect(avisos.body).toHaveLength(
        await prisma.notificacaoElo.count({ where: { usuarioId: "aluno-inatividade" } }),
      );
      expect(historico.body.metadados.total).toBe(1);

      const doOutro = await prisma.notificacaoElo.findFirstOrThrow({
        where: { usuarioId: "outro-aluno" },
      });
      const tentativa = await request(app).post(
        `/api/v1/quiz/progressao/notificacoes/${doOutro.id}/lida`,
      );

      expect(tentativa.status).toBe(404);
      expect(
        (await prisma.notificacaoElo.findUniqueOrThrow({ where: { id: doOutro.id } })).lidaEm,
      ).toBeNull();
    });
  });
});
