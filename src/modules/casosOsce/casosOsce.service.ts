import { MENSAGENS } from "@/shared/constants/mensagens";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";
import type { RespostaPaginada } from "@/shared/types/api.types";
import {
  montarMetadadosPaginacao,
  resolverParametrosPaginacao,
} from "@/shared/utils/paginacao.util";

import { converterParaRespostaCasoOsce } from "./dto/casoOsce.types";
import type {
  ListarCasosOsceQueryDto,
  RespostaCasoOsceDto,
  SalvarCasoOsceDto,
} from "./dto/casoOsce.types";
import type { CasoOsceRepository } from "./casosOsce.repository";

/**
 * Service de casos OSCE (US26). CRUD do cadastro do professor: cada campo e
 * opcional, o caso vive sempre como rascunho (nao ha acao de publicar nesta US).
 */
export class CasoOsceService {
  constructor(private readonly casoOsceRepository: CasoOsceRepository) {}

  // Lista paginada dos casos, ja convertidos para o DTO de resposta.
  async listar(query: ListarCasosOsceQueryDto): Promise<RespostaPaginada<RespostaCasoOsceDto>> {
    const paginacao = resolverParametrosPaginacao(query);
    const { data, total } = await this.casoOsceRepository.listar(paginacao);

    return {
      dados: data.map(converterParaRespostaCasoOsce),
      metadados: montarMetadadosPaginacao(paginacao, total),
    };
  }

  // Busca um caso por id (404 se nao existir).
  async buscarPorId(id: string): Promise<RespostaCasoOsceDto> {
    const caso = await this.casoOsceRepository.buscarPorId(id);

    if (!caso) {
      throw this.erroCasoNaoEncontrado(id);
    }

    return converterParaRespostaCasoOsce(caso);
  }

  // Cria um caso (rascunho); aceita payload vazio (professor so clicou "Novo caso").
  async criar(data: SalvarCasoOsceDto, criadoPorId: string): Promise<RespostaCasoOsceDto> {
    if (!criadoPorId) {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        mensagem: MENSAGENS.tokenInvalido,
      });
    }

    const caso = await this.casoOsceRepository.criar(data, criadoPorId);

    return converterParaRespostaCasoOsce(caso);
  }

  // Atualiza (merge parcial) um caso existente; 404 se nao existir.
  async atualizar(id: string, data: SalvarCasoOsceDto): Promise<RespostaCasoOsceDto> {
    const casoExistente = await this.casoOsceRepository.buscarPorId(id);

    if (!casoExistente) {
      throw this.erroCasoNaoEncontrado(id);
    }

    const caso = await this.casoOsceRepository.atualizar(id, data);

    return converterParaRespostaCasoOsce(caso);
  }

  private erroCasoNaoEncontrado(id: string) {
    return new ErroAplicacao({
      codigoStatus: 404,
      codigo: CodigoDeErro.NAO_ENCONTRADO,
      mensagem: MENSAGENS.casoOsceNaoEncontrado,
      detalhes: { id },
    });
  }
}
