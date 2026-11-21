import type { TurmaDashboardRepository } from './dashboardTurma.repository';
import type {
  DesempenhoListaDTO,
  EvolucaoTemaDTO,
  EvolucaoTemasAlunoResponseDTO,
  ResultadoTemaListaDTO,
  StatusResultadoTemaDTO,
} from './dto/dashboardTurma.types';
import { ErroAplicacao } from '@/shared/errors/erro-aplicacao';
import type { AlternativaQuestao } from '@prisma/client';

type AlternativasDaQuestao = {
  alternativaA: string;
  alternativaB: string;
  alternativaC: string;
  alternativaD: string;
  alternativaE: string;
};

const textoAlternativa = (alternativas: AlternativasDaQuestao | null, alternativa: AlternativaQuestao) => {
  if (!alternativas) return alternativa;

  const textos: Record<string, string> = {
    A: alternativas.alternativaA,
    B: alternativas.alternativaB,
    C: alternativas.alternativaC,
    D: alternativas.alternativaD,
    E: alternativas.alternativaE,
  };

  return textos[alternativa] ?? alternativa;
};

const mensagemComparacao = (totalResultadosValidos: number): string | null => {
  if (totalResultadosValidos === 0) return 'Nenhuma entrega concluída para comparação.';
  if (totalResultadosValidos === 1) {
    return 'Uma entrega disponível. São necessárias duas para comparar.';
  }
  return null;
};

/**
 * Service do dashboard da turma (visao do professor).
 *
 * Agrega as resolucoes dos alunos em metricas: desempenho individual, panorama macro
 * da turma, desempenho por lista e por aluno em uma lista. Faz a agregacao em memoria
 * a partir dos dados crus do repository.
 */
export class TurmaDashboardService {
  constructor(private readonly repository: TurmaDashboardRepository) {}

  /**
   * Desempenho individual de cada aluno da turma (geral e por tema).
   *
   * Acumula, por aluno, total respondido/acertos, ultima atividade e estatisticas por
   * tema; deriva taxa de acerto e um status (Tranquilo/Atencao/Critico) por tema.
   *
   * @param turmaId Turma analisada.
   * @returns Lista de alunos com suas metricas, ordenada por taxa de acerto.
   */
  async getDesempenhoIndividual(turmaId: string) {
    const alunosIds = await this.repository.findAlunosByTurmaId(turmaId);

    // Turma sem alunos: nada a agregar.
    if (alunosIds.length === 0) {
      return { alunos: [] };
    }

    const resolucoes = await this.repository.findResolucoesByAlunos(alunosIds);

    type StatsAluno = {
      totalRespondidas: number;
      totalAcertos: number;
      ultimaAtividade: Date | null;
      temas: Map<string, { acertos: number; total: number }>;
    };

    // Inicializa o acumulador de cada aluno (zera contadores e mapa de temas).
    const alunosMap = new Map<string, StatsAluno>();
    alunosIds.forEach((id) =>
      alunosMap.set(id, { totalRespondidas: 0, totalAcertos: 0, ultimaAtividade: null, temas: new Map() }),
    );

    // Percorre as resolucoes acumulando totais por aluno e por tema.
    resolucoes.forEach((resolucao) => {
      const acertou = resolucao.respostaMarcada === resolucao.questao.respostaCorreta;
      const nomeTema = resolucao.questao.tema.nome;
      const stats = alunosMap.get(resolucao.usuarioId)!;

      stats.totalRespondidas += 1;
      if (acertou) stats.totalAcertos += 1;

      if (!stats.ultimaAtividade || resolucao.criadoEm > stats.ultimaAtividade) {
        stats.ultimaAtividade = resolucao.criadoEm;
      }

      if (!stats.temas.has(nomeTema)) stats.temas.set(nomeTema, { acertos: 0, total: 0 });
      const t = stats.temas.get(nomeTema)!;
      t.total += 1;
      if (acertou) t.acertos += 1;
    });

    const alunos = Array.from(alunosMap.entries()).map(([alunoId, stats]) => {
      const taxaAcerto =
        stats.totalRespondidas > 0
          ? Math.round((stats.totalAcertos / stats.totalRespondidas) * 100)
          : 0;

      // Por tema: taxa de acerto + status por faixa (>=70 ok, >=40 atencao, senao critico).
      const desempenhoPorTema = Array.from(stats.temas.entries()).map(([nome, t]) => {
        const taxa = Math.round((t.acertos / t.total) * 100);
        let status = 'Crítico';
        if (taxa >= 70) status = 'Tranquilo';
        else if (taxa >= 40) status = 'Atenção';
        return { nome, totalRespondidas: t.total, taxaAcerto: taxa, status };
      });

      desempenhoPorTema.sort((a, b) => b.taxaAcerto - a.taxaAcerto);

      return {
        alunoId,
        totalRespondidas: stats.totalRespondidas,
        totalAcertos: stats.totalAcertos,
        taxaAcerto,
        ultimaAtividade: stats.ultimaAtividade?.toISOString() ?? null,
        desempenhoPorTema,
      };
    });

    alunos.sort((a, b) => b.taxaAcerto - a.taxaAcerto);

    return { alunos };
  }

  /**
   * Panorama macro da turma: totais e desempenho medio por tema.
   *
   * @param turmaId Turma analisada.
   * @param professorId Professor (nao usado no calculo; reservado p/ futura autorizacao).
   * @returns Total de alunos, total respondido, taxa media e desempenho por tema.
   */
  async getMacroDashboard(turmaId: string, professorId: string) {
    void professorId;
    const alunosIds = await this.repository.findAlunosByTurmaId(turmaId);
    
    if (alunosIds.length === 0) {
      return { totalAlunos: 0, totalQuestoesRespondidas: 0, taxaMediaAcertos: 0, desempenhoPorTema: [] };
    }

    const resolucoes = await this.repository.findResolucoesByAlunos(alunosIds);

    if (resolucoes.length === 0) {
      return { totalAlunos: alunosIds.length, totalQuestoesRespondidas: 0, taxaMediaAcertos: 0, desempenhoPorTema: [] };
    }

    // Acumula acertos gerais e estatisticas por tema sobre todas as resolucoes.
    let totalAcertosGerais = 0;
    const temasMap = new Map<string, { acertos: number; total: number }>();

    resolucoes.forEach((resolucao) => {
      const acertou = resolucao.respostaMarcada === resolucao.questao.respostaCorreta;
      const nomeTema = resolucao.questao.tema.nome;

      if (acertou) totalAcertosGerais++;

      if (!temasMap.has(nomeTema)) {
        temasMap.set(nomeTema, { acertos: 0, total: 0 });
      }
      
      const statsTema = temasMap.get(nomeTema)!;
      statsTema.total += 1;
      if (acertou) statsTema.acertos += 1;
    });

    const taxaMediaAcertos = Math.round((totalAcertosGerais / resolucoes.length) * 100);

    const desempenhoPorTema = Array.from(temasMap.entries()).map(([nome, stats]) => {
      const taxa = Math.round((stats.acertos / stats.total) * 100);
      let status = 'Crítico';
      if (taxa >= 70) status = 'Tranquilo';
      else if (taxa >= 40) status = 'Atenção';

      return { nome, totalRespondidas: stats.total, taxaAcerto: taxa, status };
    });

    desempenhoPorTema.sort((a, b) => b.taxaAcerto - a.taxaAcerto);

    return {
      totalAlunos: alunosIds.length,
      totalQuestoesRespondidas: resolucoes.length,
      taxaMediaAcertos,
      desempenhoPorTema,
    };
  }

  /**
   * Desempenho da turma agregado por lista publicada.
   *
   * Para cada lista: quantos submeteram, quantos pendentes e a taxa media de acerto.
   *
   * @param turmaId Turma analisada.
   * @param professorId Professor (reservado p/ futura autorizacao).
   * @returns Uma entrada de desempenho por lista da turma.
   */
  async getDesempenhoPorListas(
    turmaId: string,
    professorId: string,
  ): Promise<DesempenhoListaDTO[]> {
    void professorId;

    const [alunosIds, listasTurma] = await Promise.all([
      this.repository.findAlunosByTurmaId(turmaId),
      this.repository.findDesempenhoPorListasDaTurma(turmaId),
    ]);

    const totalAlunos = alunosIds.length;

    return listasTurma.map((listaTurma) => {
      // Submeteram = quem tem resolucao; pendentes = restante da turma (nunca negativo).
      const totalSubmeteram = listaTurma.resolucoes.length;
      const totalPendentes = Math.max(totalAlunos - totalSubmeteram, 0);
      const respostas = listaTurma.resolucoes.flatMap((resolucao) => resolucao.respostas);
      const totalRespostas = respostas.length;
      const totalAcertos = respostas.filter(
        (resposta) => resposta.respostaMarcada === resposta.questao.respostaCorreta,
      ).length;
      const taxaMediaAcerto =
        totalRespostas > 0 ? Number(((totalAcertos / totalRespostas) * 100).toFixed(1)) : 0;

      return {
        listaTurmaId: listaTurma.id,
        nomeLista: listaTurma.listaQuestao.nome,
        totalAlunos,
        totalSubmeteram,
        totalPendentes,
        taxaMediaAcerto,
        prazo: listaTurma.prazo?.toISOString() ?? null,
      };
    });
  }

  /**
   * Desempenho de cada aluno da turma em uma lista especifica.
   *
   * Indexa as resolucoes por aluno e classifica cada um como SUBMETIDA, EM_ANDAMENTO
   * ou NAO_RESPONDEU, calculando acertos/taxa apenas para quem submeteu.
   *
   * @param turmaId Turma analisada.
   * @param listaTurmaId Vinculo lista-turma avaliado.
   * @returns Cabecalho da lista + desempenho por aluno, ordenado por taxa de acerto.
   * @throws Error se a lista nao existir ou nao pertencer a turma.
   */
  async getDesempenhoAlunosNaLista(turmaId: string, listaTurmaId: string) {
    const [alunosIds, listaTurma] = await Promise.all([
      this.repository.findAlunosByTurmaId(turmaId),
      this.repository.findListaTurmaById(turmaId, listaTurmaId),
    ]);

    if (!listaTurma || listaTurma.turmaId !== turmaId) {
      throw new Error('Lista não encontrada ou não pertence a esta turma.');
    }

    const totalQuestoes = listaTurma.listaQuestao.itens.length;

    // Indexa as resolucoes por aluno para consulta rapida no map abaixo.
    const resolucoesMap = new Map();
    listaTurma.resolucoes.forEach((res) => {
      resolucoesMap.set(res.alunoId, res);
    });

    const alunos = alunosIds.map((alunoId) => {
      const resolucao = resolucoesMap.get(alunoId);

      // Sem resolucao submetida: marca como EM_ANDAMENTO (iniciou) ou NAO_RESPONDEU.
      if (!resolucao || resolucao.status !== 'SUBMETIDA') {
        return {
          alunoId,
          status: resolucao?.status === 'EM_ANDAMENTO' ? 'EM_ANDAMENTO' : 'NAO_RESPONDEU',
          totalAcertos: 0,
          taxaAcerto: 0,
          submissaoEm: null,
          mensagem: resolucao?.status === 'EM_ANDAMENTO' ? 'Iniciou mas não submeteu' : 'Não respondeu',
        };
      }

      const totalAcertos = resolucao.respostas.filter(
        (r: { respostaMarcada: string | null; questao: { respostaCorreta: string } }) => 
          r.respostaMarcada === r.questao.respostaCorreta
      ).length;

      const taxaAcerto = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;

      return {
        alunoId,
        status: 'SUBMETIDA',
        totalAcertos,
        taxaAcerto,
        submissaoEm: resolucao.submissaoEm?.toISOString() ?? null,
        mensagem: 'Respondida',
      };
    });

    alunos.sort((a, b) => b.taxaAcerto - a.taxaAcerto);

    return {
      listaTurmaId,
      nomeLista: listaTurma.listaQuestao.nome,
      totalQuestoes,
      desempenhoAlunos: alunos,
    };
  }

  /**
   * Detalha uma entrega submetida com os resultados de cada questao.
   * Questoes sem resposta ficam separadas dos erros, mas entram no total da taxa.
   */
  async getDetalheEntrega(
    turmaId: string,
    listaTurmaId: string,
    alunoId: string,
    professorId: string,
  ) {
    const listaTurma = await this.repository.findEntregaDoAluno(
      turmaId,
      listaTurmaId,
      alunoId,
      professorId,
    );

    const resolucao = listaTurma?.resolucoes[0];
    if (!listaTurma || !resolucao) {
      throw new ErroAplicacao({
        codigoStatus: 404,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Entrega não encontrada ou sem acesso.',
      });
    }

    const respostasPorQuestao = new Map<string, AlternativaQuestao>(
      resolucao.respostas.map((resposta) => [resposta.questaoId, resposta.respostaMarcada]),
    );

    let acertos = 0;
    let erros = 0;
    let naoRespondidas = 0;

    const questoes = listaTurma.listaQuestao.itens.map((item) => {
      const questao = item.questao;
      const respostaMarcada = respostasPorQuestao.get(questao.id) ?? null;

      if (!respostaMarcada) {
        naoRespondidas += 1;
        return {
          ordem: item.ordem,
          questaoId: questao.id,
          enunciado: questao.enunciado,
          respostaAluno: null,
          resultado: 'NAO_RESPONDIDA' as const,
          gabarito: null,
        };
      }

      const respostaAluno = {
        alternativa: respostaMarcada,
        texto: textoAlternativa(questao.alternativas, respostaMarcada),
      };

      if (respostaMarcada === questao.respostaCorreta) {
        acertos += 1;
        return {
          ordem: item.ordem,
          questaoId: questao.id,
          enunciado: questao.enunciado,
          respostaAluno,
          resultado: 'ACERTO' as const,
          gabarito: null,
        };
      }

      erros += 1;
      return {
        ordem: item.ordem,
        questaoId: questao.id,
        enunciado: questao.enunciado,
        respostaAluno,
        resultado: 'ERRO' as const,
        gabarito: {
          alternativa: questao.respostaCorreta,
          texto: textoAlternativa(questao.alternativas, questao.respostaCorreta),
        },
      };
    });

    const totalQuestoes = questoes.length;
    return {
      lista: {
        id: listaTurma.id,
        nome: listaTurma.listaQuestao.nome,
        publicadaEm: listaTurma.criadoEm.toISOString(),
      },
      alunoId,
      resumo: {
        totalQuestoes,
        acertos,
        erros,
        naoRespondidas,
        taxaAcerto: totalQuestoes > 0 ? Math.round((acertos / totalQuestoes) * 100) : 0,
      },
      questoes,
    };
  }

  /**
   * Compara o desempenho do aluno por tema entre as listas publicadas da turma.
   * Pendencias aparecem no historico, mas nao interrompem nem alteram a variacao.
   */
  async getEvolucaoTemasAluno(
    turmaId: string,
    alunoId: string,
    professorId: string,
    inicio?: Date,
    fim?: Date,
  ): Promise<EvolucaoTemasAlunoResponseDTO> {
    const temAcesso = await this.repository.professorTemAcessoAoAluno(
      turmaId,
      alunoId,
      professorId,
    );

    if (!temAcesso) {
      throw new ErroAplicacao({
        codigoStatus: 404,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Turma ou aluno não encontrado ou sem acesso.',
      });
    }

    const listas = await this.repository.findListasParaEvolucaoTemas(
      turmaId,
      alunoId,
      professorId,
      inicio,
      fim,
    );

    const temas = new Map<
      string,
      {
        nome: string;
        resultados: ResultadoTemaListaDTO[];
        ultimaTaxaValida: number | null;
        totalResultadosValidos: number;
      }
    >();

    for (const lista of listas) {
      const resolucao = lista.resolucoes[0];
      const respostas = new Map(
        resolucao?.respostas.map((resposta) => [resposta.questaoId, resposta.respostaMarcada]) ?? [],
      );
      const itensPorTema = new Map<
        string,
        {
          nome: string;
          itens: typeof lista.listaQuestao.itens;
        }
      >();

      for (const item of lista.listaQuestao.itens) {
        const tema = item.questao.tema;
        const agrupamento = itensPorTema.get(tema.id) ?? { nome: tema.nome, itens: [] };
        agrupamento.itens.push(item);
        itensPorTema.set(tema.id, agrupamento);
      }

      for (const [temaId, agrupamento] of itensPorTema) {
        const evolucao = temas.get(temaId) ?? {
          nome: agrupamento.nome,
          resultados: [],
          ultimaTaxaValida: null,
          totalResultadosValidos: 0,
        };
        const totalQuestoes = agrupamento.itens.length;
        const status: StatusResultadoTemaDTO = resolucao?.status ?? 'NAO_RESPONDEU';
        const entregaValida = status === 'SUBMETIDA';

        let acertos: number | null = null;
        let taxaAcerto: number | null = null;
        let variacaoPp: number | null = null;

        if (entregaValida) {
          acertos = agrupamento.itens.filter(
            (item) => respostas.get(item.questao.id) === item.questao.respostaCorreta,
          ).length;
          taxaAcerto = totalQuestoes > 0 ? Math.round((acertos / totalQuestoes) * 100) : 0;
          variacaoPp =
            evolucao.ultimaTaxaValida === null ? null : taxaAcerto - evolucao.ultimaTaxaValida;
          evolucao.ultimaTaxaValida = taxaAcerto;
          evolucao.totalResultadosValidos += 1;
        }

        evolucao.resultados.push({
          listaTurmaId: lista.id,
          nomeLista: lista.listaQuestao.nome,
          publicadaEm: lista.criadoEm.toISOString(),
          status,
          acertos,
          totalQuestoes,
          taxaAcerto,
          variacaoPp,
        });
        temas.set(temaId, evolucao);
      }
    }

    const resultado: EvolucaoTemaDTO[] = Array.from(temas.entries())
      .map(([temaId, tema]) => ({
        temaId,
        nome: tema.nome,
        totalResultadosValidos: tema.totalResultadosValidos,
        mensagem: mensagemComparacao(tema.totalResultadosValidos),
        resultados: tema.resultados,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return { alunoId, temas: resultado };
  }
}
