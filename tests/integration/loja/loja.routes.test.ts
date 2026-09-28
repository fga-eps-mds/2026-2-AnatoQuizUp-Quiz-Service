import request from "supertest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import {
  AlternativaQuestao,
  Dificuldade,
  FonteMoeda,
  StatusQuestao,
  TipoEfeitoItem,
  TipoItemLoja,
  TipoQuestao,
  OrigemItemInventario,
} from "@prisma/client";
import { prisma } from "@/config/db";
import { lojaRouter } from "@/modules/loja/loja.routes";
import { quizRouter } from "@/modules/quiz/quiz.routes";
import { TIPO_QUESTAO_API } from "@/modules/questoes/dto/question.types";
import { middlewareTratamentoErros } from "@/shared/middlewares/tratamento-erros.middleware";

interface AuthenticatedRequest extends Request {
  usuario?: { id: string; papel: string };
}

let mockUsuarioId = "aluno-123";

jest.mock("@/shared/middlewares/papeis.middleware", () => ({
  middlewarePapeis: () => (req: Request, _res: Response, next: NextFunction) => {
    (req as AuthenticatedRequest).usuario = { id: mockUsuarioId, papel: "ALUNO" };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use("/api/v1/loja", lojaRouter);
app.use("/api/v1/quiz", quizRouter);
app.use(middlewareTratamentoErros);

describe("Testes de Integração - Loja", () => {
  const limparBanco = async () => {
    await prisma.transacaoMoeda.deleteMany();
    await prisma.usoItem.deleteMany();
    await prisma.inventarioItem.deleteMany();
    await prisma.carteiraMoedas.deleteMany();
    await prisma.itemLoja.deleteMany();
  };

  beforeEach(async () => {
    mockUsuarioId = "aluno-123";
    await limparBanco();
  });

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect();
  });

  describe("GET /api/v1/loja/catalogo", () => {
    it("deve listar os itens ativos do catálogo", async () => {
      await prisma.itemLoja.create({
        data: {
          codigo: "ITEM-1",
          nome: "Avatar Dourado",
          tipo: TipoItemLoja.AVATAR,
          precoMoedas: 100,
          ativo: true,
          disponivelNaLoja: true,
        },
      });

      const response = await request(app).get("/api/v1/loja/catalogo");

      expect(response.status).toBe(200);
      const body = response.body as { dados: Array<{ nome: string }> };
      expect(body.dados).toHaveLength(1);
      expect(body.dados[0].nome).toBe("Avatar Dourado");
    });
  });

  describe("POST /api/v1/loja/comprar", () => {
    it("deve comprar um item com sucesso", async () => {
      const item = await prisma.itemLoja.create({
        data: {
          codigo: "ITEM-2",
          nome: "Skin Premium",
          tipo: TipoItemLoja.PLANO_FUNDO,
          precoMoedas: 50,
          ativo: true,
          disponivelNaLoja: true,
        },
      });

      await prisma.carteiraMoedas.create({
        data: { usuarioId: "aluno-123", saldo: 100 },
      });

      const response = await request(app)
        .post("/api/v1/loja/comprar")
        .send({ itemLojaId: item.id });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        saldoMoedas: 50,
        quantidadeComprada: 1,
        item: {
          equipado: false,
          origem: "COMPRA",
          quantidade: 1,
          item: { id: item.id, nome: "Skin Premium" },
        },
      });

      const inventario = await request(app).get("/api/v1/loja/meu-inventario");
      expect(inventario.status).toBe(200);
      expect(inventario.body.dados).toEqual([
        expect.objectContaining({ item: expect.objectContaining({ id: item.id }) }),
      ]);
    });

    it("deve retornar erro 422 ao comprar item com saldo insuficiente", async () => {
      const item = await prisma.itemLoja.create({
        data: {
          codigo: "ITEM-3",
          nome: "Item Caro",
          tipo: TipoItemLoja.TITULO,
          precoMoedas: 500,
          ativo: true,
          disponivelNaLoja: true,
        },
      });

      await prisma.carteiraMoedas.create({
        data: { usuarioId: "aluno-123", saldo: 10 },
      });

      const response = await request(app)
        .post("/api/v1/loja/comprar")
        .send({ itemLojaId: item.id });

      expect(response.status).toBe(422);
      const body = response.body as { erro: { mensagem: string } };
      expect(body.erro.mensagem).toBe("Saldo de moedas insuficiente para comprar este item.");
    });

    it("deve comprar um consumível várias vezes, somando a quantidade e registrando cada compra", async () => {
      const item = await prisma.itemLoja.create({
        data: {
          codigo: "dica-teste",
          nome: "Vacina da Dica",
          tipo: TipoItemLoja.DICA,
          consumivel: true,
          efeito: "Revela uma dica para a questão.",
          precoMoedas: 50,
        },
      });

      await prisma.carteiraMoedas.create({
        data: { usuarioId: "aluno-123", saldo: 300 },
      });

      const primeira = await request(app)
        .post("/api/v1/loja/comprar")
        .send({ itemLojaId: item.id, quantidade: 2 });

      expect(primeira.status).toBe(200);
      expect(primeira.body).toMatchObject({
        saldoMoedas: 200,
        quantidadeComprada: 2,
        item: { quantidade: 2, item: { consumivel: true } },
      });

      const segunda = await request(app)
        .post("/api/v1/loja/comprar")
        .send({ itemLojaId: item.id });

      expect(segunda.status).toBe(200);
      expect(segunda.body).toMatchObject({
        saldoMoedas: 150,
        quantidadeComprada: 1,
        item: { quantidade: 3 },
      });

      const transacoes = await prisma.transacaoMoeda.findMany({
        where: { usuarioId: "aluno-123", itemLojaId: item.id },
        orderBy: { criadoEm: "asc" },
      });

      expect(transacoes.map((t) => [t.quantidade, t.quantidadeItem])).toEqual([
        [-100, 2],
        [-50, 1],
      ]);

      const catalogo = await request(app).get("/api/v1/loja/catalogo");
      const body = catalogo.body as {
        dados: Array<{ id: string; adquirido: boolean; quantidadePossuida: number }>;
      };
      expect(body.dados.find((dado) => dado.id === item.id)).toMatchObject({
        adquirido: false,
        quantidadePossuida: 3,
      });
    });

    it("não deve alterar saldo nem inventário quando o total da compra passa do saldo", async () => {
      const item = await prisma.itemLoja.create({
        data: {
          codigo: "tempo-teste",
          nome: "Tempo Extra",
          tipo: TipoItemLoja.POTENCIALIZADOR,
          consumivel: true,
          precoMoedas: 60,
        },
      });

      await prisma.carteiraMoedas.create({
        data: { usuarioId: "aluno-123", saldo: 100 },
      });

      await prisma.inventarioItem.create({
        data: { usuarioId: "aluno-123", itemLojaId: item.id, quantidade: 1 },
      });

      // 2 x 60 = 120 > 100
      const response = await request(app)
        .post("/api/v1/loja/comprar")
        .send({ itemLojaId: item.id, quantidade: 2 });

      expect(response.status).toBe(422);

      const carteira = await prisma.carteiraMoedas.findUnique({
        where: { usuarioId: "aluno-123" },
      });
      const inventario = await prisma.inventarioItem.findUnique({
        where: { usuarioId_itemLojaId: { usuarioId: "aluno-123", itemLojaId: item.id } },
      });
      const transacoes = await prisma.transacaoMoeda.count({ where: { itemLojaId: item.id } });

      expect(carteira?.saldo).toBe(100);
      expect(inventario?.quantidade).toBe(1);
      expect(transacoes).toBe(0);
    });

    it("deve recusar comprar de novo um cosmético já adquirido, sem debitar", async () => {
      const item = await prisma.itemLoja.create({
        data: {
          codigo: "moldura-teste",
          nome: "Moldura Teste",
          tipo: TipoItemLoja.MOLDURA,
          precoMoedas: 30,
        },
      });

      await prisma.carteiraMoedas.create({
        data: { usuarioId: "aluno-123", saldo: 100 },
      });

      const primeira = await request(app).post("/api/v1/loja/comprar").send({ itemLojaId: item.id });
      const segunda = await request(app).post("/api/v1/loja/comprar").send({ itemLojaId: item.id });

      expect(primeira.status).toBe(200);
      expect(segunda.status).toBe(409);

      const carteira = await prisma.carteiraMoedas.findUnique({
        where: { usuarioId: "aluno-123" },
      });
      expect(carteira?.saldo).toBe(70);
    });

    it("deve rejeitar quantidade inválida com erro de validação", async () => {
      const response = await request(app)
        .post("/api/v1/loja/comprar")
        .send({ itemLojaId: "qualquer", quantidade: 0 });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/loja/meu-inventario", () => {
    it("deve listar os itens adquiridos pelo aluno", async () => {
      const item = await prisma.itemLoja.create({
        data: {
          codigo: "ITEM-4",
          nome: "Moldura Básica",
          tipo: TipoItemLoja.MOLDURA,
          precoMoedas: 10,
          ativo: true,
          disponivelNaLoja: true,
        },
      });

      await prisma.inventarioItem.create({
        data: {
          usuarioId: "aluno-123",
          itemLojaId: item.id,
          origem: OrigemItemInventario.COMPRA,
        },
      });

      const response = await request(app).get("/api/v1/loja/meu-inventario");

      expect(response.status).toBe(200);
      const body = response.body as { dados: Array<{ item: { nome: string } }> };
      expect(body.dados).toHaveLength(1);
      expect(body.dados[0].item.nome).toBe("Moldura Básica");
    });
  });

  describe("GET /api/v1/loja/meu-historico", () => {
    it("cobre compra, uso, consumo no quiz e consulta da cronologia", async () => {
      const cafe = await prisma.itemLoja.create({
        data: {
          codigo: "cafe-fluxo-completo",
          nome: "Cafe do Foco",
          tipo: TipoItemLoja.POTENCIALIZADOR,
          consumivel: true,
          tipoEfeito: TipoEfeitoItem.DOBRAR_MOEDAS_PROXIMO_ACERTO,
          efeito: "Dobra o proximo acerto.",
          precoMoedas: 20,
        },
      });
      await prisma.carteiraMoedas.create({ data: { usuarioId: "aluno-123", saldo: 100 } });
      const tema = await prisma.tema.create({ data: { nome: "Anatomia - fluxo loja" } });
      const questao = await prisma.questao.create({
        data: {
          enunciado: "Qual alternativa esta correta?",
          tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA,
          respostaCorreta: AlternativaQuestao.A,
          dificuldade: Dificuldade.FACIL,
          temaId: tema.id,
          criadoPorId: "prof-123",
          status: StatusQuestao.ATIVO,
        },
      });

      await expect(request(app).post("/api/v1/loja/comprar").send({ itemLojaId: cafe.id })).resolves.toMatchObject({ status: 200 });
      await expect(request(app).post("/api/v1/loja/usar").send({ itemLojaId: cafe.id })).resolves.toMatchObject({ status: 200 });
      const respostaQuiz = await request(app).post("/api/v1/quiz/responder").send({
        questaoId: questao.id,
        tipo: TIPO_QUESTAO_API.MULTIPLA_ESCOLHA,
        respostaMarcada: AlternativaQuestao.A,
      });

      expect(respostaQuiz.status).toBe(200);
      expect(respostaQuiz.body.potencializadorAplicado).toMatchObject({ nome: "Cafe do Foco" });
      const historico = await request(app).get("/api/v1/loja/meu-historico");
      expect(historico.status).toBe(200);
      expect(historico.body.dados).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ acao: "COMPRA", item: { id: cafe.id, nome: "Cafe do Foco" }, custoCompra: 20 }),
          expect.objectContaining({ acao: "USO", item: { id: cafe.id, nome: "Cafe do Foco" }, statusUso: "APLICADO", efeitoUso: "Dobra o proximo acerto." }),
        ]),
      );
    });

    it("unifica compras e usos, mantendo os dados isolados por usuário", async () => {
      const item = await prisma.itemLoja.create({
        data: {
          codigo: "cafe-historico-teste",
          nome: "Cafe do Foco",
          tipo: TipoItemLoja.POTENCIALIZADOR,
          consumivel: true,
          tipoEfeito: TipoEfeitoItem.DOBRAR_MOEDAS_PROXIMO_ACERTO,
          precoMoedas: 20,
        },
      });

      const usoA = await prisma.usoItem.create({
        data: {
          usuarioId: "aluno-A",
          itemLojaId: item.id,
          tipoEfeito: TipoEfeitoItem.DOBRAR_MOEDAS_PROXIMO_ACERTO,
        },
      });
      const usoB = await prisma.usoItem.create({
        data: {
          usuarioId: "aluno-B",
          itemLojaId: item.id,
          tipoEfeito: TipoEfeitoItem.DOBRAR_MOEDAS_PROXIMO_ACERTO,
        },
      });
      await prisma.carteiraMoedas.createMany({
        data: [{ usuarioId: "aluno-A", saldo: 0 }, { usuarioId: "aluno-B", saldo: 0 }],
      });
      const compraA = await prisma.transacaoMoeda.create({
        data: {
          usuarioId: "aluno-A",
          itemLojaId: item.id,
          quantidade: -20,
          quantidadeItem: 1,
          fonte: FonteMoeda.COMPRA_ITEM,
        },
      });

      mockUsuarioId = "aluno-A";
      const respostaA = await request(app).get(
        "/api/v1/loja/meu-historico?usuarioId=aluno-B",
      );

      expect(respostaA.status).toBe(200);
      expect(respostaA.body.dados).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: compraA.id, acao: "COMPRA", custoCompra: 20, item: { id: item.id, nome: "Cafe do Foco" } }),
          expect.objectContaining({ id: usoA.id, acao: "USO", efeitoUso: expect.any(String) }),
        ]),
      );
      expect(respostaA.body.metadados.total).toBe(2);

      mockUsuarioId = "aluno-B";
      const respostaB = await request(app).get("/api/v1/loja/meu-historico");

      expect(respostaB.status).toBe(200);
      expect(respostaB.body.dados.map((registro: { id: string }) => registro.id)).toEqual([
        usoB.id,
      ]);
      expect(respostaB.body.metadados.total).toBe(1);
    });
  });
});
