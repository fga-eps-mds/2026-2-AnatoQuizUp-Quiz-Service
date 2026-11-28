import request from "supertest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import { Dificuldade, StatusCasoOsce } from "@prisma/client";

import { prisma } from "@/config/db";
import { casoOsceRouter } from "@/modules/casosOsce/casosOsce.routes";
import { middlewareTratamentoErros } from "@/shared/middlewares/tratamento-erros.middleware";
import type { RespostaCasoOsceDto } from "@/modules/casosOsce/dto/casoOsce.types";
import type { RespostaApiSucesso, RespostaPaginada } from "@/shared/types/api.types";

interface AuthenticatedRequest extends Request {
  usuario?: { id: string; papel: string };
}

// Papel mockado por teste: comeca como PROFESSOR, o teste de 403 troca pra ALUNO.
let mockPapel = "PROFESSOR";

jest.mock("@/shared/middlewares/papeis.middleware", () => ({
  middlewarePapeis: (...papeisPermitidos: string[]) => (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    (req as AuthenticatedRequest).usuario = { id: "prof-osce-123", papel: mockPapel };

    if (!papeisPermitidos.includes(mockPapel)) {
      return res.status(403).json({ erro: { codigo: "PROIBIDO", mensagem: "Acesso nao autorizado" } });
    }

    return next();
  },
}));

const app = express();
app.use(express.json());
app.use("/api/v1/casos-osce", casoOsceRouter);
app.use(middlewareTratamentoErros);

describe("Testes de Integração - Casos OSCE", () => {
  const limparBanco = async () => {
    await prisma.exameCasoOsce.deleteMany();
    await prisma.casoOsce.deleteMany();
  };

  beforeEach(async () => {
    mockPapel = "PROFESSOR";
    await limparBanco();
  });

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect();
  });

  describe("autorizacao", () => {
    it("responde 403 para papel ALUNO", async () => {
      mockPapel = "ALUNO";

      const response = await request(app).get("/api/v1/casos-osce");

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/v1/casos-osce", () => {
    it("cria um caso vazio como rascunho (professor so clicou 'Novo caso')", async () => {
      const response = await request(app).post("/api/v1/casos-osce").send({});

      expect(response.status).toBe(201);
      const body = response.body as RespostaApiSucesso<RespostaCasoOsceDto>;
      expect(body.dados.status).toBe(StatusCasoOsce.RASCUNHO);
      expect(body.dados.titulo).toBeNull();
    });

    it("cria um caso com os dados gerais informados", async () => {
      const response = await request(app).post("/api/v1/casos-osce").send({
        titulo: "Dor torácica",
        especialidade: "Cardiologia",
        dificuldade: Dificuldade.MEDIA,
        diagnosticoEsperado: "Infarto",
      });

      expect(response.status).toBe(201);
      const body = response.body as RespostaApiSucesso<RespostaCasoOsceDto>;
      expect(body.dados.titulo).toBe("Dor torácica");
      expect(body.dados.dificuldade).toBe(Dificuldade.MEDIA);
    });
  });

  describe("GET /api/v1/casos-osce", () => {
    it("lista os casos cadastrados", async () => {
      await prisma.casoOsce.create({ data: { titulo: "Caso A", criadoPorId: "prof-osce-123" } });

      const response = await request(app).get("/api/v1/casos-osce");

      expect(response.status).toBe(200);
      const body = response.body as RespostaPaginada<RespostaCasoOsceDto>;
      expect(body.dados).toHaveLength(1);
    });
  });

  describe("GET /api/v1/casos-osce/:id", () => {
    it("responde 404 para id inexistente", async () => {
      const response = await request(app).get("/api/v1/casos-osce/id-que-nao-existe");

      expect(response.status).toBe(404);
    });

    it("busca um caso existente, com os exames", async () => {
      const caso = await prisma.casoOsce.create({
        data: {
          titulo: "Caso com exame",
          criadoPorId: "prof-osce-123",
          exames: { create: [{ nome: "Hemograma", resultado: "Normal" }] },
        },
      });

      const response = await request(app).get(`/api/v1/casos-osce/${caso.id}`);

      expect(response.status).toBe(200);
      const body = response.body as RespostaApiSucesso<RespostaCasoOsceDto>;
      expect(body.dados.exames).toEqual([{ nome: "Hemograma", resultado: "Normal" }]);
    });
  });

  describe("PATCH /api/v1/casos-osce/:id", () => {
    it("responde 404 para id inexistente", async () => {
      const response = await request(app)
        .patch("/api/v1/casos-osce/id-que-nao-existe")
        .send({ titulo: "X" });

      expect(response.status).toBe(404);
    });

    it("atualiza (merge parcial) um caso existente, passo a passo", async () => {
      const caso = await prisma.casoOsce.create({
        data: { titulo: "Rascunho inicial", criadoPorId: "prof-osce-123" },
      });

      // Passo 2: contextualizacao, sem repetir o titulo do passo 1.
      const response = await request(app).patch(`/api/v1/casos-osce/${caso.id}`).send({
        local: "Pronto-socorro",
        papelEstudante: "Médico(a) responsável",
        idadePaciente: 40,
        sexoPaciente: "Feminino",
        queixaPaciente: "Dor abdominal",
      });

      expect(response.status).toBe(200);
      const body = response.body as RespostaApiSucesso<RespostaCasoOsceDto>;
      expect(body.dados.titulo).toBe("Rascunho inicial");
      expect(body.dados.local).toBe("Pronto-socorro");
    });

    it("substitui a lista de exames quando reenviada", async () => {
      const caso = await prisma.casoOsce.create({
        data: {
          titulo: "Caso com exame antigo",
          criadoPorId: "prof-osce-123",
          exames: { create: [{ nome: "Exame antigo", resultado: "X" }] },
        },
      });

      const response = await request(app)
        .patch(`/api/v1/casos-osce/${caso.id}`)
        .send({ exames: [{ nome: "Exame novo", resultado: "Y" }] });

      expect(response.status).toBe(200);
      const body = response.body as RespostaApiSucesso<RespostaCasoOsceDto>;
      expect(body.dados.exames).toEqual([{ nome: "Exame novo", resultado: "Y" }]);
    });
  });

    describe("PUT /api/v1/casos-osce/:id/checklist", () => {
    const item = (nome: string) => ({ dominio: "Encerramento", nome, criterioCompleto: "Faz.", peso: 1 });

    it("salva, reordena e remove itens", async () => {
      const caso = await prisma.casoOsce.create({ data: { criadoPorId: "prof-osce-123" } });
      const url = `/api/v1/casos-osce/${caso.id}/checklist`;

      await request(app).put(url).send({ itens: [item("A"), item("B"), item("C")] });
      const response = await request(app).put(url).send({ itens: [item("C"), item("A")] });

      expect(response.status).toBe(200);
      const busca = await request(app).get(`/api/v1/casos-osce/${caso.id}`);
      const body = busca.body as RespostaApiSucesso<RespostaCasoOsceDto>;
      expect(body.dados.itensChecklist.map((i) => i.nome)).toEqual(["C", "A"]);
      expect(body.dados.itensChecklist[0]?.criterioParcial).toBeNull();
    });

    it("responde 404 para caso inexistente", async () => {
      const response = await request(app).put("/api/v1/casos-osce/nao-existe/checklist").send({ itens: [] });

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/v1/casos-osce/:id/avaliacao", () => {
    const configuracao = {
      faixaExcelente: 90,
      faixaBom: 75,
      faixaSuficiente: 60,
      faixaLimitrofe: 50,
      corteAprovacao: 60,
      itemCriticoReprova: true,
      escalaGlobal: ["0", "1", "2", "3", "4"],
    };

    it("cria e depois atualiza a configuracao", async () => {
      const caso = await prisma.casoOsce.create({ data: { criadoPorId: "prof-osce-123" } });
      const url = `/api/v1/casos-osce/${caso.id}/avaliacao`;

      await request(app).put(url).send(configuracao);
      const response = await request(app)
        .put(url)
        .send({ ...configuracao, corteAprovacao: 70, liberarResultado: false });

      expect(response.status).toBe(200);
      const body = response.body as RespostaApiSucesso<RespostaCasoOsceDto>;
      expect(body.dados.configuracaoAvaliacao).toMatchObject({ corteAprovacao: 70, liberarResultado: false });
    });

    it("responde 400 para faixas fora de ordem", async () => {
      const caso = await prisma.casoOsce.create({ data: { criadoPorId: "prof-osce-123" } });

      const response = await request(app)
        .put(`/api/v1/casos-osce/${caso.id}/avaliacao`)
        .send({ ...configuracao, faixaBom: 95 });

      expect(response.status).toBe(400);
    });
  });
  
  describe("DELETE /api/v1/casos-osce/:id", () => {
    it("responde 404 para id inexistente", async () => {
      const response = await request(app).delete("/api/v1/casos-osce/id-que-nao-existe");

      expect(response.status).toBe(404);
    });

    it("responde 403 quando o caso pertence a outro professor", async () => {
      const caso = await prisma.casoOsce.create({
        data: { titulo: "Caso de outro professor", criadoPorId: "outro-professor-id" },
      });

      const response = await request(app).delete(`/api/v1/casos-osce/${caso.id}`);

      expect(response.status).toBe(403);
    });

    it("exclui (soft delete) um caso do proprio professor, retornando 204", async () => {
      const caso = await prisma.casoOsce.create({
        data: { titulo: "Caso a excluir", criadoPorId: "prof-osce-123" },
      });

      const response = await request(app).delete(`/api/v1/casos-osce/${caso.id}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      const registro = await prisma.casoOsce.findUnique({ where: { id: caso.id } });
      expect(registro?.excluidoEm).not.toBeNull();
    });

    it("some de listar, detalhar e atualizar apos a exclusao", async () => {
      const caso = await prisma.casoOsce.create({
        data: { titulo: "Caso a excluir", criadoPorId: "prof-osce-123" },
      });

      await request(app).delete(`/api/v1/casos-osce/${caso.id}`);

      const listagem = await request(app).get("/api/v1/casos-osce");
      expect((listagem.body as RespostaPaginada<RespostaCasoOsceDto>).dados).toHaveLength(0);

      const detalhe = await request(app).get(`/api/v1/casos-osce/${caso.id}`);
      expect(detalhe.status).toBe(404);

      const atualizacao = await request(app)
        .patch(`/api/v1/casos-osce/${caso.id}`)
        .send({ titulo: "X" });
      expect(atualizacao.status).toBe(404);
    });

    it("responde 404 ao tentar excluir um caso ja excluido", async () => {
      const caso = await prisma.casoOsce.create({
        data: { titulo: "Caso a excluir duas vezes", criadoPorId: "prof-osce-123" },
      });

      await request(app).delete(`/api/v1/casos-osce/${caso.id}`);
      const segundaExclusao = await request(app).delete(`/api/v1/casos-osce/${caso.id}`);

      expect(segundaExclusao.status).toBe(404);
    });
  });
});
