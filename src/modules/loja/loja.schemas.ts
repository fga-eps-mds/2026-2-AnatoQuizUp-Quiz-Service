import { z } from "zod";

// Schemas Zod da loja, mais os tipos inferidos usados pelo controller/service.

// Tipos de itens disponiveis no catalogo: cosmeticos e consumiveis (DICA/POTENCIALIZADOR).
export const VALORES_TIPO_ITEM_LOJA = [
  "ICONE_PERFIL",
  "MOLDURA",
  "AVATAR",
  "TITULO",
  "PLANO_FUNDO",
  "DICA",
  "POTENCIALIZADOR",
] as const;

// Limite de unidades por compra, para evitar pedidos absurdos de itens consumiveis.
export const QUANTIDADE_MAXIMA_POR_COMPRA = 99;

// Query do catalogo: filtro por tipo e paginacao.
export const schemaListarCatalogo = z.object({
  tipo: z.enum(VALORES_TIPO_ITEM_LOJA).optional(),

  page: z.coerce.number().int().min(1).optional(),

  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Query do inventario: apenas paginacao.
export const schemaListarInventario = z.object({
  page: z.coerce.number().int().min(1).optional(),

  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Body da compra: id do item desejado e quantidade (padrao 1; so consumiveis aceitam mais de 1).
export const schemaComprarItem = z.object({
  itemLojaId: z.string().trim().min(1, "ID do item e obrigatorio."),
  quantidade: z.coerce
    .number()
    .int("A quantidade deve ser um numero inteiro.")
    .min(1, "A quantidade minima e 1.")
    .max(QUANTIDADE_MAXIMA_POR_COMPRA, `A quantidade maxima por compra e ${QUANTIDADE_MAXIMA_POR_COMPRA}.`)
    .default(1),
});

// Tipos inferidos a partir dos schemas (fonte unica de verdade do formato).
export type ListarCatalogoQueryDto = z.infer<typeof schemaListarCatalogo>;

export type ListarInventarioQueryDto = z.infer<typeof schemaListarInventario>;

export type ComprarItemDto = z.infer<typeof schemaComprarItem>;
