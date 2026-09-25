import type { NextFunction, Request, Response } from "express";

import type { LojaService } from "./loja.service";
import type {
  ComprarItemDto,
  ListarCatalogoQueryDto,
  ListarInventarioQueryDto,
} from "./loja.schemas";

// Controller HTTP da loja: catalogo (cosmeticos e consumiveis), inventario do aluno e compra.
export class LojaController {
  constructor(private readonly lojaService: LojaService) {}

  /**
   * GET catalogo de itens; usa o id do usuario para marcar o que ele ja possui.
   *
   * @param request Requisicao com filtros/paginacao na query (usuario vem do token).
   * @param response Resposta com o catalogo paginado.
   * @param next Repasse de erro ao middleware central.
   */
  listarCatalogo = async (
    request: Request<unknown, unknown, unknown, ListarCatalogoQueryDto>,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const catalogo = await this.lojaService.listarCatalogo(request.usuario?.id, request.query);

      return response.status(200).json(catalogo);
    } catch (error) {
      return next(error);
    }
  };

  /**
   * GET itens que o aluno ja adquiriu (com filtros opcionais na query).
   *
   * @param request Requisicao com a paginacao na query (usuario vem do token).
   * @param response Resposta com o inventario paginado.
   * @param next Repasse de erro ao middleware central.
   */
  listarInventario = async (
    request: Request<unknown, unknown, unknown, ListarInventarioQueryDto>,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const inventario = await this.lojaService.listarInventario(
        request.usuario?.id,
        request.query,
      );

      return response.status(200).json(inventario);
    } catch (error) {
      return next(error);
    }
  };

  /**
   * POST compra um item; o service valida saldo e debita as moedas.
   *
   * @param request Requisicao com itemLojaId e quantidade no corpo (usuario vem do token).
   * @param response Resposta com o resultado da compra.
   * @param next Repasse de erro ao middleware central.
   */
  comprar = async (
    request: Request<unknown, unknown, ComprarItemDto>,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const compra = await this.lojaService.comprar(
        request.usuario?.id,
        request.body.itemLojaId,
        request.body.quantidade,
      );

      return response.status(200).json(compra);
    } catch (error) {
      return next(error);
    }
  };
}
