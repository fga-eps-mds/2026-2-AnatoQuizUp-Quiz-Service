import type { OrigemItemInventario, TipoItemLoja } from "@prisma/client";

// DTOs do modulo de loja.

// Item do catalogo. "adquirido" indica se o usuario ja possui o cosmetico (sempre
// false para consumiveis, que podem ser recomprados); "quantidadePossuida" traz
// quantas unidades ele tem hoje (0 se nenhuma).
export type ItemLojaDto = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  tipo: TipoItemLoja;
  precoMoedas: number;
  valor: string | null;
  imagemUrl: string | null;
  previewImagemUrl: string | null;
  ativo: boolean;
  disponivelNaLoja: boolean;
  consumivel: boolean;
  efeito: string | null;
  adquirido: boolean;
  quantidadePossuida: number;
};

// Item ja possuido pelo usuario (no inventario); aqui "adquirido" e implicito.
export type InventarioItemDto = {
  id: string;
  equipado: boolean;
  origem: OrigemItemInventario;
  quantidade: number;
  adquiridoEm: Date;
  item: Omit<ItemLojaDto, "adquirido" | "quantidadePossuida">;
};

// Resultado de uma compra: mensagem, saldo atualizado, unidades compradas e o
// registro do item no inventario (com a quantidade total ja atualizada).
export type CompraItemDto = {
  mensagem: string;
  saldoMoedas: number;
  quantidadeComprada: number;
  item: InventarioItemDto;
};

export type UsoItemDto = {
  id: string;
  itemLojaId: string;
  itemNome: string;
  efeito: string;
  status: "ATIVO" | "APLICADO";
  ativadoEm: Date;
  aplicadoEm: Date | null;
  questaoId: string | null;
};
