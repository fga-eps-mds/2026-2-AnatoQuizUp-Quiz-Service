import {
  schemaComprarItem,
  schemaListarCatalogo,
  schemaListarInventario,
} from "@/modules/loja/loja.schemas";

describe("Testa Loja Schemas", () => {
  describe("schemaListarCatalogo", () => {
    test("deve validar busca de catalogo sem filtros", () => {
      const resultado = schemaListarCatalogo.safeParse({});

      expect(resultado.success).toBe(true);
    });

    test("deve validar busca de catalogo com filtros", () => {
      const resultado = schemaListarCatalogo.safeParse({
        tipo: "AVATAR",
        page: "2",
        limit: "10",
      });

      expect(resultado.success).toBe(true);

      if (resultado.success) {
        expect(resultado.data.page).toBe(2);
        expect(resultado.data.limit).toBe(10);
      }
    });

    test("deve validar todos os tipos de item da loja", () => {
      for (const tipo of [
        "ICONE_PERFIL",
        "MOLDURA",
        "AVATAR",
        "TITULO",
        "PLANO_FUNDO",
        "ROSTO",
        "CABELO",
        "DICA",
        "POTENCIALIZADOR",
      ]) {
        expect(schemaListarCatalogo.safeParse({ tipo }).success).toBe(true);
      }
    });

    test("deve rejeitar tipo invalido", () => {
      const resultado = schemaListarCatalogo.safeParse({
        tipo: "ROUPA",
      });

      expect(resultado.success).toBe(false);
    });

    test("deve rejeitar page menor que 1", () => {
      const resultado = schemaListarCatalogo.safeParse({
        page: 0,
      });

      expect(resultado.success).toBe(false);
    });

    test("deve rejeitar limit maior que 100", () => {
      const resultado = schemaListarCatalogo.safeParse({
        limit: 101,
      });

      expect(resultado.success).toBe(false);
    });
  });

  describe("schemaListarInventario", () => {
    test("deve validar busca de inventario sem filtros", () => {
      const resultado = schemaListarInventario.safeParse({});

      expect(resultado.success).toBe(true);
    });

    test("deve validar coercao de page e limit", () => {
      const resultado = schemaListarInventario.safeParse({
        page: "1",
        limit: "10",
      });

      expect(resultado.success).toBe(true);

      if (resultado.success) {
        expect(resultado.data.page).toBe(1);
        expect(resultado.data.limit).toBe(10);
      }
    });

    test("deve rejeitar limit decimal", () => {
      const resultado = schemaListarInventario.safeParse({
        limit: 10.5,
      });

      expect(resultado.success).toBe(false);
    });
  });

  describe("schemaComprarItem", () => {
    test("deve validar compra com itemLojaId e usar quantidade 1 por padrao", () => {
      const resultado = schemaComprarItem.safeParse({
        itemLojaId: "item-id",
      });

      expect(resultado.success).toBe(true);

      if (resultado.success) {
        expect(resultado.data.quantidade).toBe(1);
      }
    });

    test("deve aceitar e converter a quantidade informada", () => {
      const resultado = schemaComprarItem.safeParse({
        itemLojaId: "item-id",
        quantidade: "3",
      });

      expect(resultado.success).toBe(true);

      if (resultado.success) {
        expect(resultado.data.quantidade).toBe(3);
      }
    });

    test.each([0, -1, 1.5, 100])("deve rejeitar quantidade invalida (%p)", (quantidade) => {
      const resultado = schemaComprarItem.safeParse({
        itemLojaId: "item-id",
        quantidade,
      });

      expect(resultado.success).toBe(false);
    });

    test("deve rejeitar compra sem itemLojaId", () => {
      const resultado = schemaComprarItem.safeParse({});

      expect(resultado.success).toBe(false);
    });

    test("deve rejeitar itemLojaId vazio", () => {
      const resultado = schemaComprarItem.safeParse({
        itemLojaId: "",
      });

      expect(resultado.success).toBe(false);
    });
  });
});
