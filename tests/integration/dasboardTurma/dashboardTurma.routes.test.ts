import request from "supertest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import { 
  AlternativaQuestao, 
  StatusResolucaoLista, 
  TipoQuestao 
} from "@prisma/client";

jest.mock("@/shared/middlewares/papeis.middleware", () => ({
  middlewarePapeis: () => (req: Request, _res: Response, next: NextFunction) => {
    req.usuario = {
      id: "prof-teste-123",
      email: "professor@teste.com",
      papel: "PROFESSOR",
      status: "ATIVO",
    };
    next();
  },
}));

import { prisma } from "@/config/db";
import { dashboardRouter } from "@/modules/dashboardTurma/dashboardTurma.routes";

const app = express();
app.use(express.json());
app.use("/api/v1/turmas", dashboardRouter);

describe("Testes de Integração - Dashboard Turma", () => {
  const limparBanco = async () => {
    await prisma.resolucaoQuestaoLista.deleteMany();
    await prisma.resolucaoLista.deleteMany();
    await prisma.listaTurma.deleteMany();
    await prisma.listaQuestaoItem.deleteMany();
    await prisma.listaQuestao.deleteMany();
    await prisma.turmaAluno.deleteMany();
    await prisma.turma.deleteMany();
    await prisma.resolucaoQuestao.deleteMany();
    await prisma.questao.deleteMany();
    await prisma.tema.deleteMany();
  };

  beforeEach(async () => {
    await limparBanco();
  });

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect();
  });

  const setupBase = async () => {
    const turma = await prisma.turma.create({
      data: { codigo: "T1", nome: "Turma A", semestre: "1", ano: 2026, descricao: "Desc", professorId: "prof-teste-123" }
    });
    
    await prisma.turmaAluno.create({ 
      data: { turmaId: turma.id, alunoId: "aluno-1" } 
    });
    
    const tema = await prisma.tema.create({ data: { nome: "Anatomia" } });
    
    const questao = await prisma.questao.create({
      data: { enunciado: "Q1", tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA, respostaCorreta: AlternativaQuestao.A, temaId: tema.id, criadoPorId: "prof-teste-123" }
    });
    
    return { turma, tema, questao };
  };

  describe("GET /api/v1/turmas/:id/macro", () => {
    it("deve retornar o dashboard macro com sucesso", async () => {
      const { turma, questao } = await setupBase();
      
      await prisma.resolucaoQuestao.create({
        data: { usuarioId: "aluno-1", questaoId: questao.id, respostaMarcada: AlternativaQuestao.A }
      });

      const response = await request(app).get(`/api/v1/turmas/${turma.id}/macro`);

      expect(response.status).toBe(200);
      
      const body = response.body as { totalQuestoesRespondidas: number; taxaMediaAcertos: number };
      expect(body).toHaveProperty("totalQuestoesRespondidas", 1);
      expect(body.taxaMediaAcertos).toBe(100);
    });
  });

  describe("GET /api/v1/turmas/:id/individual", () => {
    it("deve listar desempenho individual dos alunos", async () => {
      const { turma, questao } = await setupBase();
      
      await prisma.resolucaoQuestao.create({
        data: { usuarioId: "aluno-1", questaoId: questao.id, respostaMarcada: AlternativaQuestao.A }
      });

      const response = await request(app).get(`/api/v1/turmas/${turma.id}/individual`);

      expect(response.status).toBe(200);
      const body = response.body as { alunos: Array<{ alunoId: string }> };
      expect(body.alunos).toHaveLength(1);
      expect(body.alunos[0].alunoId).toBe("aluno-1");
    });
  });

  describe("GET /api/v1/turmas/:id/listas", () => {
    it("deve calcular o desempenho por listas corretamente", async () => {
      const { turma, questao } = await setupBase();
      
      const listaQ = await prisma.listaQuestao.create({ data: { nome: "Lista 1", criadoPorId: "prof-teste-123" } });
      await prisma.listaQuestaoItem.create({ data: { listaQuestaoId: listaQ.id, questaoId: questao.id, ordem: 1 } });
      const listaTurma = await prisma.listaTurma.create({ data: { turmaId: turma.id, listaQuestaoId: listaQ.id } });
      
      const resolucao = await prisma.resolucaoLista.create({
        data: { alunoId: "aluno-1", listaTurmaId: listaTurma.id, status: StatusResolucaoLista.SUBMETIDA }
      });
      await prisma.resolucaoQuestaoLista.create({
        data: { resolucaoListaId: resolucao.id, questaoId: questao.id, respostaMarcada: AlternativaQuestao.A }
      });

      const response = await request(app).get(`/api/v1/turmas/${turma.id}/listas`);

      expect(response.status).toBe(200);
      const body = response.body as Array<{ nomeLista: string; totalSubmeteram: number }>;
      expect(body[0].nomeLista).toBe("Lista 1");
      expect(body[0].totalSubmeteram).toBe(1);
    });

    it("deve retornar 403 quando o professor não for o responsável pela turma", async () => {
      const outraTurma = await prisma.turma.create({
        data: { codigo: "T-OUTRA", nome: "Turma Privada", semestre: "1", ano: 2026, descricao: "Privada", professorId: "outro-professor" }
      });

      const response = await request(app).get(`/api/v1/turmas/${outraTurma.id}/listas`);

      expect(response.status).toBe(403);
    });

    it("deve retornar 404 quando a turma não existir", async () => {
      const validCuid = "clm123456789012345678901";

      const response = await request(app).get(`/api/v1/turmas/${validCuid}/listas`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/v1/turmas/:id/listas/:listaId", () => {
    it("deve retornar erro 404 se a lista não pertencer à turma", async () => {
      const { turma } = await setupBase();
      
      const validCuid = "clm123456789012345678901"; 
      
      const response = await request(app).get(`/api/v1/turmas/${turma.id}/listas/${validCuid}`);
      
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/v1/turmas/:id/listas/:listaId/top-erros", () => {
    it("retorna dados corretos para uma lista publicada com erros", async () => {
      const { turma, tema } = await setupBase();
      const questao1 = await prisma.questao.create({
        data: { enunciado: "Q1 top erros", tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA, respostaCorreta: AlternativaQuestao.A, temaId: tema.id, criadoPorId: "prof-teste-123" }
      });
      const questao2 = await prisma.questao.create({
        data: { enunciado: "Q2 top erros", tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA, respostaCorreta: AlternativaQuestao.B, temaId: tema.id, criadoPorId: "prof-teste-123" }
      });
      const lista = await prisma.listaQuestao.create({ data: { nome: "Lista Top Erros", criadoPorId: "prof-teste-123" } });
      await prisma.listaQuestaoItem.createMany({
        data: [
          { listaQuestaoId: lista.id, questaoId: questao1.id, ordem: 1 },
          { listaQuestaoId: lista.id, questaoId: questao2.id, ordem: 2 },
        ],
      });
      const listaTurma = await prisma.listaTurma.create({ data: { turmaId: turma.id, listaQuestaoId: lista.id } });

      for (const alunoId of ["aluno-1", "aluno-2"]) {
        const resolucao = await prisma.resolucaoLista.create({
          data: { alunoId, listaTurmaId: listaTurma.id, status: StatusResolucaoLista.SUBMETIDA }
        });
        await prisma.resolucaoQuestaoLista.createMany({
          data: [
            { resolucaoListaId: resolucao.id, questaoId: questao1.id, respostaMarcada: AlternativaQuestao.B },
            { resolucaoListaId: resolucao.id, questaoId: questao2.id, respostaMarcada: AlternativaQuestao.B },
          ],
        });
      }

      const response = await request(app).get(`/api/v1/turmas/${turma.id}/listas/${listaTurma.id}/top-erros`);

      expect(response.status).toBe(200);
      expect(response.body.totalAlunosResponderam).toBe(2);
      expect(response.body.questoes).toEqual([
        expect.objectContaining({
          questaoId: questao1.id,
          numeroQuestao: 1,
          totalErros: 2,
          totalRespostas: 2,
          percentualErro: 100,
        }),
      ]);
    });

    it("retorna lista vazia para lista sem respostas submetidas", async () => {
      const { turma, tema } = await setupBase();
      const questao = await prisma.questao.create({
        data: { enunciado: "Q sem respostas", tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA, respostaCorreta: AlternativaQuestao.A, temaId: tema.id, criadoPorId: "prof-teste-123" }
      });
      const lista = await prisma.listaQuestao.create({ data: { nome: "Lista vazia", criadoPorId: "prof-teste-123" } });
      await prisma.listaQuestaoItem.create({ data: { listaQuestaoId: lista.id, questaoId: questao.id, ordem: 1 } });
      const listaTurma = await prisma.listaTurma.create({ data: { turmaId: turma.id, listaQuestaoId: lista.id } });

      const response = await request(app).get(`/api/v1/turmas/${turma.id}/listas/${listaTurma.id}/top-erros`);

      expect(response.status).toBe(200);
      expect(response.body.questoes).toEqual([]);
    });

    it("não inclui respostas de outra turma", async () => {
      const { turma, tema } = await setupBase();
      const outraTurma = await prisma.turma.create({
        data: { codigo: "T2", nome: "Turma B", semestre: "1", ano: 2026, descricao: "Outra", professorId: "prof-teste-123" }
      });
      const questao = await prisma.questao.create({
        data: { enunciado: "Q isolamento", tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA, respostaCorreta: AlternativaQuestao.A, temaId: tema.id, criadoPorId: "prof-teste-123" }
      });
      const lista = await prisma.listaQuestao.create({ data: { nome: "Lista isolada", criadoPorId: "prof-teste-123" } });
      await prisma.listaQuestaoItem.create({ data: { listaQuestaoId: lista.id, questaoId: questao.id, ordem: 1 } });
      const listaOutraTurma = await prisma.listaTurma.create({ data: { turmaId: outraTurma.id, listaQuestaoId: lista.id } });
      const resolucao = await prisma.resolucaoLista.create({
        data: { alunoId: "aluno-outra", listaTurmaId: listaOutraTurma.id, status: StatusResolucaoLista.SUBMETIDA }
      });
      await prisma.resolucaoQuestaoLista.create({
        data: { resolucaoListaId: resolucao.id, questaoId: questao.id, respostaMarcada: AlternativaQuestao.B }
      });
      const listaTurma = await prisma.listaTurma.create({ data: { turmaId: turma.id, listaQuestaoId: lista.id } });

      const response = await request(app).get(`/api/v1/turmas/${turma.id}/listas/${listaTurma.id}/top-erros`);

      expect(response.status).toBe(200);
      expect(response.body.totalAlunosResponderam).toBe(0);
      expect(response.body.questoes).toEqual([]);
    });

    it("retorna erro para professor sem vínculo com a turma", async () => {
      const turma = await prisma.turma.create({
        data: { codigo: "T3", nome: "Turma sem vínculo", semestre: "1", ano: 2026, descricao: "Sem vínculo", professorId: "outro-professor" }
      });
      const lista = await prisma.listaQuestao.create({ data: { nome: "Lista privada", criadoPorId: "outro-professor" } });
      const listaTurma = await prisma.listaTurma.create({ data: { turmaId: turma.id, listaQuestaoId: lista.id } });

      const response = await request(app).get(`/api/v1/turmas/${turma.id}/listas/${listaTurma.id}/top-erros`);

      expect(response.status).toBe(404);
    });
  });
});