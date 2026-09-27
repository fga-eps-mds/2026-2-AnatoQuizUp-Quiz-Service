import request from "supertest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import { TipoItemLoja } from "@prisma/client";

jest.mock("@/shared/middlewares/papeis.middleware", () => ({
  middlewarePapeis: () => (req: Request, _res: Response, next: NextFunction) => {
    req.usuario = {
      id: "aluno-teste-123",
      email: "aluno-teste@example.com",
      papel: "ALUNO",
      status: "ATIVO",
    };
    next();
  },
}));

import { prisma } from "@/config/db";
import { inventarioRoutes } from "@/modules/inventario/inventario.routes";

const app = express();
app.use(express.json());
app.use("/api/v1/inventario", inventarioRoutes);

describe("Testes de Integração - Inventário", () => {
  const limparBanco = async () => {
    await prisma.inventarioItem.deleteMany();
    await prisma.itemLoja.deleteMany();
  };

  beforeEach(async () => {
    await limparBanco();
  });

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect();
  });

  const setupItem = async (tipo: TipoItemLoja) => {
    return await prisma.itemLoja.create({
      data: {
        codigo: `ITEM-${Math.random()}`,
        nome: "Item de Teste",
        tipo: tipo,
        precoMoedas: 100,
      },
    });
  };

  describe("PATCH /api/v1/inventario/equipar", () => {
    it("deve equipar um item e desequipar o anterior do mesmo tipo", async () => {
      const item1 = await setupItem(TipoItemLoja.AVATAR);
      const item2 = await setupItem(TipoItemLoja.AVATAR);

      const inv1 = await prisma.inventarioItem.create({ 
        data: { usuarioId: "aluno-teste-123", itemLojaId: item1.id, equipado: true } 
      });
      const inventarioOutroAluno = await prisma.inventarioItem.create({
        data: { usuarioId: "aluno-diferente", itemLojaId: item1.id, equipado: true },
      });
      await prisma.inventarioItem.create({ 
        data: { usuarioId: "aluno-teste-123", itemLojaId: item2.id, equipado: false } 
      });

      const response = await request(app)
        .patch("/api/v1/inventario/equipar")
        .send({ itemLojaId: item2.id });

      expect(response.status).toBe(200);

      const item1Atualizado = await prisma.inventarioItem.findUnique({ where: { id: inv1.id } });
      const itemOutroAlunoAtualizado = await prisma.inventarioItem.findUnique({
        where: { id: inventarioOutroAluno.id },
      });
      const item2Atualizado = await prisma.inventarioItem.findFirst({ where: { itemLojaId: item2.id } });

      expect(item1Atualizado?.equipado).toBe(false);
      expect(itemOutroAlunoAtualizado?.equipado).toBe(true);
      expect(item2Atualizado?.equipado).toBe(true);
    });
  });

  describe("GET /api/v1/inventario/meuInventario", () => {
    it("deve listar todos os itens do inventário", async () => {
      const item = await setupItem(TipoItemLoja.ICONE_PERFIL);
      await prisma.inventarioItem.create({ 
        data: { usuarioId: "aluno-teste-123", itemLojaId: item.id } 
      });

      const response = await request(app).get("/api/v1/inventario/meuInventario");

      expect(response.status).toBe(200);
      expect(response.body.dados).toHaveLength(1);
      expect(response.body.dados[0].nome).toBe("Item de Teste");
    });
  });

  describe("GET /api/v1/inventario/meuPerfil", () => {
    it("deve retornar apenas os itens equipados", async () => {
      const item1 = await setupItem(TipoItemLoja.ICONE_PERFIL);
      const item2 = await setupItem(TipoItemLoja.TITULO);
      
      await prisma.inventarioItem.create({ data: { usuarioId: "aluno-teste-123", itemLojaId: item1.id, equipado: true } });
      await prisma.inventarioItem.create({ data: { usuarioId: "aluno-teste-123", itemLojaId: item2.id, equipado: false } });

      const response = await request(app).get("/api/v1/inventario/meuPerfil");

      expect(response.status).toBe(200);
      expect(response.body.dados).toHaveLength(1);
      expect(response.body.dados[0].tipo).toBe("ICONE_PERFIL");
    });
  });

  describe("GET /api/v1/inventario/usuarios/equipados", () => {
    it("deve retornar os perfis de múltiplos usuários", async () => {
      const item = await setupItem(TipoItemLoja.AVATAR);
      
      await prisma.inventarioItem.create({ data: { usuarioId: "aluno-A", itemLojaId: item.id, equipado: true } });
      await prisma.inventarioItem.create({ data: { usuarioId: "aluno-B", itemLojaId: item.id, equipado: true } });

      const response = await request(app).get("/api/v1/inventario/usuarios/equipados?usuarioIds=aluno-A,aluno-B");

      expect(response.status).toBe(200);
      // Cast explícito apenas para facilitar a leitura da resposta pelo Jest sem 'any'
      const dados = response.body.dados as Record<string, unknown>;
      expect(dados).toHaveProperty("aluno-A");
      expect(dados).toHaveProperty("aluno-B");
    });
  });

  describe("PATCH /api/v1/inventario/desequipar", () => {
    it("deve desequipar um item com sucesso", async () => {
      const item = await setupItem(TipoItemLoja.AVATAR);
      const inv = await prisma.inventarioItem.create({ 
        data: { usuarioId: "aluno-teste-123", itemLojaId: item.id, equipado: true } 
      });

      const response = await request(app)
        .patch("/api/v1/inventario/desequipar")
        .send({ itemLojaId: item.id });

      expect(response.status).toBe(200);
      
      const invAtualizado = await prisma.inventarioItem.findUnique({ where: { id: inv.id } });
      expect(invAtualizado?.equipado).toBe(false);
    });
  });
});