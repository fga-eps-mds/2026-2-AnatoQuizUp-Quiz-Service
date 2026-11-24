import type {
  AlternativaQuestao,
  Questao,
  QuestaoAlternativa,
  StatusQuestao,
  Tema,
  Dificuldade,
  Prisma,
  TaxonomiaBloom,
  OrigemQuestao,
} from "@prisma/client";

// Tipos, DTOs e conversores do dominio de questoes (entrada da API, registro do
// banco e resposta), alem do helper que monta o filtro Prisma a partir da query.

// Tipos de questao expostos pela API.
export const TIPO_QUESTAO_API = {
  MULTIPLA_ESCOLHA: "MULTIPLA_ESCOLHA",
  CERTO_ERRADO: "CERTO_ERRADO",
} as const;

export type TipoQuestaoApi = (typeof TIPO_QUESTAO_API)[keyof typeof TIPO_QUESTAO_API];

// Niveis de dificuldade expostos pela API.
export const DIFICULDADE_API = {
  FACIL: "FACIL",
  MEDIA: "MEDIA",
  DIFICIL: "DIFICIL",
} as const;

export type DificuldadeApi = (typeof DIFICULDADE_API)[keyof typeof DIFICULDADE_API];

export type AlternativasMultiplaEscolhaDto = {
  A: string;
  B: string;
  C: string;
  D: string;
  E: string;
};

export type AlternativasCertoErradoDto = {
  C: string;
  E: string;
};

// Alternativas conforme o tipo: A-E (multipla escolha) ou C/E (certo-errado).
export type AlternativasQuestaoDto =
  | AlternativasMultiplaEscolhaDto
  | AlternativasCertoErradoDto;

// Payload de criacao de questao (entrada ja validada).
export type CriarQuestaoDto = {
  tema: string;
  enunciado: string;
  tipo: TipoQuestaoApi;
  dificuldade: Dificuldade;
  imagem: string;
  alternativaCorreta: AlternativaQuestao;
  saibaMais: string;
  taxonomiaBloom?: TaxonomiaBloom;
  origemQuestao?: OrigemQuestao;
  regiaoAnatomica?: string;
  palavrasChave?: string | string[];
  alternativas: AlternativasQuestaoDto;
};

// Edicao: versao parcial do payload de criacao.
export type AtualizarQuestaoDto = Partial<CriarQuestaoDto>;

// Query de listagem simples (so paginacao).
export type ListarQuestoesQueryDto = {
  page?: number;
  limit?: number;
};

// Query de filtros do banco de questoes.
export type FiltroListarQuestoesQueryDto = {
  page?: number;
  limit?: number;
  somenteErros?: boolean;
  tema?: string;
  dificuldade?: DificuldadeApi;
  tipo?: TipoQuestaoApi;
  taxonomiaBloom?: TaxonomiaBloom;
};

// Questao do banco com tema e alternativas carregados (forma "completa").
export type RegistroQuestaoCompleta = Questao & {
  tema: Tema;
  alternativas: QuestaoAlternativa | null;
};

// Questao no formato de resposta da API (datas em string, alternativas normalizadas).
export type RespostaQuestaoDto = {
  id: string;
  tema: {
    id: string;
    nome: string;
  };
  enunciado: string;
  tipo: TipoQuestaoApi;
  dificuldade: DificuldadeApi;
  imagem: string | null;
  alternativaCorreta: AlternativaQuestao;
  saibaMais: string | null;
  taxonomiaBloom: TaxonomiaBloom | null;
  origemQuestao: OrigemQuestao;
  regiaoAnatomica: string | null;
  palavrasChave: string[];
  alternativas: Partial<AlternativasMultiplaEscolhaDto>;
  status: StatusQuestao;
  criadoPorId: string;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm: string | null;
};

// Monta o objeto de alternativas para a resposta conforme o tipo (C/E ou A-E).
export function montarAlternativas(tipo: TipoQuestaoApi, alternativas: QuestaoAlternativa | null) {
  if (tipo === TIPO_QUESTAO_API.CERTO_ERRADO) {
    return {
      C: alternativas?.alternativaC,
      E: alternativas?.alternativaE,
    };
  }

  return {
    A: alternativas?.alternativaA,
    B: alternativas?.alternativaB,
    C: alternativas?.alternativaC,
    D: alternativas?.alternativaD,
    E: alternativas?.alternativaE,
  };
}

// Converte a questao completa do banco para o DTO de resposta (datas em ISO).
export function converterParaRespostaQuestao(questao: RegistroQuestaoCompleta): RespostaQuestaoDto {
  const tipo = questao.tipoQuestao;
  const alternativas = montarAlternativas(tipo, questao.alternativas);

  return {
    id: questao.id,
    tema: {
      id: questao.tema.id,
      nome: questao.tema.nome,
    },
    enunciado: questao.enunciado,
    tipo,
    dificuldade: questao.dificuldade as DificuldadeApi,
    imagem: questao.urlImagem,
    alternativaCorreta: questao.respostaCorreta,
    saibaMais: questao.saibaMais,
    taxonomiaBloom: questao.taxonomiaBloom,
    origemQuestao: questao.origemQuestao,
    regiaoAnatomica: questao.regiaoAnatomica,
    palavrasChave: questao.palavrasChave ?? [],
    alternativas,
    status: questao.status,
    criadoPorId: questao.criadoPorId,
    criadoEm: questao.criadoEm.toISOString(),
    atualizadoEm: questao.atualizadoEm.toISOString(),
    excluidoEm: questao.excluidoEm?.toISOString() ?? null,
  };
}

// Traduz os filtros da query em um where do Prisma (base: questoes ativas).
export function montarFiltroPrisma(
  filtros: FiltroListarQuestoesQueryDto,
): Prisma.QuestaoWhereInput {
  const where: Prisma.QuestaoWhereInput = {
    excluidoEm: null,
    status: "ATIVO",
  };

  // Cada filtro presente acrescenta uma condicao ao where.
  if (filtros.tema) {
    where.tema = { nome: { contains: filtros.tema, mode: "insensitive" } };
  }

  if (filtros.dificuldade) {
    where.dificuldade = filtros.dificuldade;
  }

  if (filtros.tipo) {
    where.tipoQuestao = filtros.tipo;
  }

  if (filtros.taxonomiaBloom) {
    where.taxonomiaBloom = filtros.taxonomiaBloom;
  }

  return where;
}
