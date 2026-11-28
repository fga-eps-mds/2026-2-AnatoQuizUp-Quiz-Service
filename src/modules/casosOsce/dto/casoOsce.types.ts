import type {
  CasoOsce,
  ConfiguracaoAvaliacaoOsce,
  Dificuldade,
  ExameCasoOsce,
  ItemChecklistOsce,
  StatusCasoOsce,
} from "@prisma/client";

// Registro completo (com exames) retornado pelo repository.
export type RegistroCasoOsceCompleto = CasoOsce & {
  exames: ExameCasoOsce[];
  itensChecklist: ItemChecklistOsce[];
  configuracaoAvaliacao: ConfiguracaoAvaliacaoOsce | null;
};

export type ExameCasoOsceDto = {
  nome: string;
  resultado: string;
};

// Payload de criacao/edicao: todos os campos sao opcionais (rascunho preenchido
// aos poucos, passo a passo, com autosave a cada etapa do editor).
export type SalvarCasoOsceDto = {
  titulo?: string;
  especialidade?: string;
  dificuldade?: Dificuldade;
  diagnosticoEsperado?: string;
  local?: string;
  papelEstudante?: string;
  idadePaciente?: number;
  sexoPaciente?: string;
  queixaPaciente?: string;
  perfilPaciente?: string;
  historiaSintomas?: string;
  exameFisico?: string;
  exames?: ExameCasoOsceDto[];
};

export type ListarCasosOsceQueryDto = {
  page?: number;
  limit?: number;
};

// DTO de resposta: mesmos campos do registro, sem os metadados internos (excluidoEm).
export type RespostaCasoOsceDto = {
  id: string;
  titulo: string | null;
  especialidade: string | null;
  dificuldade: Dificuldade | null;
  diagnosticoEsperado: string | null;
  local: string | null;
  papelEstudante: string | null;
  idadePaciente: number | null;
  sexoPaciente: string | null;
  queixaPaciente: string | null;
  perfilPaciente: string | null;
  historiaSintomas: string | null;
  exameFisico: string | null;
  status: StatusCasoOsce;
  criadoPorId: string;
  exames: ExameCasoOsceDto[];
  itensChecklist: ItemChecklistDto[];           
  configuracaoAvaliacao: ConfiguracaoAvaliacaoDto | null; 
  criadoEm: Date;
  atualizadoEm: Date;
};

export function converterParaRespostaCasoOsce(
  caso: RegistroCasoOsceCompleto,
): RespostaCasoOsceDto {
  return {
    id: caso.id,
    titulo: caso.titulo,
    especialidade: caso.especialidade,
    dificuldade: caso.dificuldade,
    diagnosticoEsperado: caso.diagnosticoEsperado,
    local: caso.local,
    papelEstudante: caso.papelEstudante,
    idadePaciente: caso.idadePaciente,
    sexoPaciente: caso.sexoPaciente,
    queixaPaciente: caso.queixaPaciente,
    perfilPaciente: caso.perfilPaciente,
    historiaSintomas: caso.historiaSintomas,
    exameFisico: caso.exameFisico,
    status: caso.status,
    criadoPorId: caso.criadoPorId,
    exames: caso.exames.map((exame) => ({ nome: exame.nome, resultado: exame.resultado })),
    itensChecklist: caso.itensChecklist.map((item) => ({
      dominio: item.dominio,
      nome: item.nome,
      criterioCompleto: item.criterioCompleto,
      criterioParcial: item.criterioParcial,
      peso: item.peso,
      critico: item.critico,
      comentarioFeedback: item.comentarioFeedback,
    })),
    configuracaoAvaliacao: caso.configuracaoAvaliacao
      ? {
          faixaExcelente: caso.configuracaoAvaliacao.faixaExcelente,
          faixaBom: caso.configuracaoAvaliacao.faixaBom,
          faixaSuficiente: caso.configuracaoAvaliacao.faixaSuficiente,
          faixaLimitrofe: caso.configuracaoAvaliacao.faixaLimitrofe,
          corteAprovacao: caso.configuracaoAvaliacao.corteAprovacao,
          itemCriticoReprova: caso.configuracaoAvaliacao.itemCriticoReprova,
          escalaGlobal: caso.configuracaoAvaliacao.escalaGlobal as string[],
          liberarResultado: caso.configuracaoAvaliacao.liberarResultado,
        }
      : null,
    criadoEm: caso.criadoEm,
    atualizadoEm: caso.atualizadoEm,
  };
}

export type ItemChecklistDto = {
  dominio: string;
  nome: string;
  criterioCompleto: string;
  criterioParcial?: string | null;
  peso: number;
  critico: boolean;
  comentarioFeedback?: string | null;
};

export type SalvarChecklistDto = { itens: ItemChecklistDto[] };

export type ConfiguracaoAvaliacaoDto = {
  faixaExcelente: number;
  faixaBom: number;
  faixaSuficiente: number;
  faixaLimitrofe: number;
  corteAprovacao: number;
  itemCriticoReprova: boolean;
  escalaGlobal: string[];
  liberarResultado: boolean;
};
