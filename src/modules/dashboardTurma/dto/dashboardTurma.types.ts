// DTOs do dashboard da turma (visao do professor).

// Desempenho medio da turma em um tema.
export interface TemaDesempenhoDTO {
  nome: string;
  totalRespondidas: number;
  taxaAcerto: number;
  status: 'Tranquilo' | 'Atenção' | 'Crítico';
}

// Visao macro da turma: totais e desempenho por tema.
export interface DashboardMacroResponseDTO {
  totalAlunos: number;
  totalQuestoesRespondidas: number;
  taxaMediaAcertos: number;
  desempenhoPorTema: TemaDesempenhoDTO[];
}

// Desempenho da turma em uma lista (entregas, pendencias e taxa media).
export interface DesempenhoListaDTO {
  listaTurmaId: string;
  nomeLista: string;
  totalAlunos: number;
  totalSubmeteram: number;
  totalPendentes: number;
  taxaMediaAcerto: number;
  prazo: string | null;
}

export interface TopErroQuestaoDTO {
  questaoId: string;
  numeroQuestao: number;
  enunciado: string;
  tema: string;
  totalErros: number;
  totalRespostas: number;
  percentualErro: number;
}

export interface TopErrosResponseDTO {
  listaTurmaId: string;
  nomeLista: string;
  totalAlunosResponderam: number;
  questoes: TopErroQuestaoDTO[];
}