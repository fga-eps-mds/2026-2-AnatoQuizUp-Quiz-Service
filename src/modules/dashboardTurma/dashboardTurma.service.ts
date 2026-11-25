import { PAPEIS } from '@/shared/constants/papeis';
import { CodigoDeErro } from '@/shared/errors/codigos-de-erro';
import { ErroAplicacao } from '@/shared/errors/erro-aplicacao';
import type { TurmaDashboardRepository } from './dashboardTurma.repository';
import type {
  DesempenhoListaDTO,
  EvolucaoTemaDTO,
  EvolucaoTemasAlunoResponseDTO,
  ResultadoTemaListaDTO,
  StatusResultadoTemaDTO,
  TopErrosResponseDTO,
} from './dto/dashboardTurma.types';

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

  async getHistoricoListasAluno(turmaId: string, alunoId: string, professorId: string, inicio: Date, fim: Date) {
    const turma = await this.repository.findHistoricoListasAluno(turmaId, alunoId, professorId, inicio, fim);
    if (!turma) return null;

    return turma.listas.map((lista) => ({
      listaTurmaId: lista.id,
      nomeLista: lista.listaQuestao.nome,
      publicadaEm: lista.criadoEm.toISOString(),
      status: lista.resolucoes.length > 0 ? 'ENTREGUE' as const : 'PENDENTE' as const,
    }));
  }

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
   * Valida se a turma existe e se o usuario autenticado tem permissao para
   * consulta-la (professor responsavel ou administrador). Para cada lista:
   * quantos submeteram, quantos pendentes e a taxa media de acerto.
   *
   * @param turmaId Turma analisada.
   * @param professorId Id do usuario autenticado.
   * @param papel Papel do usuario autenticado (opcional; ADMINISTRADOR tem acesso amplo).
   * @returns Uma entrada de desempenho por lista da turma.
   * @throws ErroAplicacao 404 se a turma nao existir ou 403 se o professor nao for o responsavel.
   */
  async getDesempenhoPorListas(
    turmaId: string,
    professorId: string,
    papel?: string,
  ): Promise<DesempenhoListaDTO[]> {
    const turma = await this.repository.findTurmaById(turmaId);

    if (!turma) {
      throw new ErroAplicacao({
        codigo: CodigoDeErro.NAO_ENCONTRADO,
        mensagem: 'Turma não encontrada.',
        codigoStatus: 404,
      });
    }

    if (papel !== PAPEIS.ADMINISTRADOR && turma.professorId !== professorId) {
      throw new ErroAplicacao({
        codigo: CodigoDeErro.PROIBIDO,
        mensagem: 'Você não tem permissão para acessar esta turma.',
        codigoStatus: 403,
      });
    }

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

  async getTopQuestoesComMaisErros(turmaId: string, listaTurmaId: string, professorId: string): Promise<TopErrosResponseDTO> {
    const lista = await this.repository.findRespostasParaRankingErros(turmaId, listaTurmaId);

    if (lista?.turma?.professorId !== professorId) {
      throw new Error('Lista não encontrada ou não pertence a esta turma.');
    }

    const totalAlunosResponderam = lista.resolucoes.length;

    // Mapeia informações das questões para acesso rápido
    const infoQuestoes = new Map<string, { numero: number; enunciado: string; tema: string; respostaCorreta: string }>();
    lista.listaQuestao.itens.forEach(item => {
      infoQuestoes.set(item.questaoId, {
        numero: item.ordem, 
        enunciado: item.questao.enunciado,
        tema: item.questao.tema.nome,
        respostaCorreta: item.questao.respostaCorreta
      });
    });

    // Acumulador de estatísticas por questão
    const estatisticas = new Map<string, { erros: number; totalRespostas: number }>();
    infoQuestoes.forEach((_, questaoId) => {
      estatisticas.set(questaoId, { erros: 0, totalRespostas: 0 });
    });

    // Processa as respostas (T05.2)
    lista.resolucoes.forEach(resolucao => {
      resolucao.respostas.forEach(resposta => {
        const info = infoQuestoes.get(resposta.questaoId);
        if (!info) return; 

        const stats = estatisticas.get(resposta.questaoId)!;
        stats.totalRespostas += 1;
        
        // Verifica se errou
        if (resposta.respostaMarcada !== info.respostaCorreta) {
          stats.erros += 1;
        }
      });
    });

    // Transforma em Array e calcula percentual
    const questoesComErros = Array.from(estatisticas.entries())
      .map(([questaoId, stats]) => {
        const info = infoQuestoes.get(questaoId)!;
        return {
          questaoId,
          numeroQuestao: info.numero,
          enunciado: info.enunciado,
          tema: info.tema,
          totalErros: stats.erros,
          totalRespostas: stats.totalRespostas,
          percentualErro: stats.totalRespostas > 0 ? Math.round((stats.erros / stats.totalRespostas) * 100) : 0,
        };
      })
      .filter(q => q.totalErros > 0); 

    // Ordenação: Maior erro (desc), depois menor número da questão (asc) 
    questoesComErros.sort((a, b) => {
      if (b.totalErros !== a.totalErros) {
        return b.totalErros - a.totalErros;
      }
      return a.numeroQuestao - b.numeroQuestao;
    });

    // Pega o Top 3
    const top3 = questoesComErros.slice(0, 3);

    return {
      listaTurmaId: lista.id,
      nomeLista: lista.listaQuestao.nome,
      totalAlunosResponderam,
      questoes: top3,
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
