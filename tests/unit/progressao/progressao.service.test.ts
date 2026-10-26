import { EloXp, EstadoElo, StatusTentativaQuiz } from "@prisma/client";

import type {
  ProgressaoRepository,
  TentativaParaConclusao,
  TransacaoXpComTentativa,
} from "@/modules/progressao/progressao.repository";
import { ProgressaoService } from "@/modules/progressao/progressao.service";
import {
  aplicarInatividade,
  aplicarInatividadeEmLote,
  buscarConfiguracao,
  buscarConfiguracaoCompleta,
  listarHistoricoElo,
  listarNotificacoes,
  marcarNotificacaoLida,
  montarRetratoInatividade,
  salvarConfiguracao,
} from "@/modules/progressao/elo.repository";
import type { RegistroQuestaoCompleta } from "@/modules/questoes/dto/question.types";
import { MENSAGENS } from "@/shared/constants/mensagens";
import { PAPEIS } from "@/shared/constants/papeis";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";

jest.mock("@/modules/progressao/elo.repository", () => ({
  aplicarInatividade: jest.fn(),
  aplicarInatividadeEmLote: jest.fn(),
  buscarConfiguracao: jest.fn(),
  buscarConfiguracaoCompleta: jest.fn(),
  listarHistoricoElo: jest.fn(),
  listarNotificacoes: jest.fn(),
  marcarNotificacaoLida: jest.fn(),
  montarRetratoInatividade: jest.fn(),
  salvarConfiguracao: jest.fn(),
}));

const agora = new Date("2026-10-09T12:00:00.000Z");

function criarQuestao(id: string): RegistroQuestaoCompleta {
  return {
    id,
    enunciado: `Enunciado ${id}`,
    tipoQuestao: "MULTIPLA_ESCOLHA",
    respostaCorreta: "B",
    saibaMais: null,
    status: "ATIVO",
    origemQuestao: "ELABORADA_POR_PROFESSOR",
    taxonomiaBloom: null,
    regiaoAnatomica: null,
    urlImagem: null,
    criadoPorId: "professor-1",
    temaId: "tema-1",
    questaoOriginalId: null,
    dificuldade: "FACIL",
    criadoEm: agora,
    atualizadoEm: agora,
    excluidoEm: null,
    tema: { id: "tema-1", nome: "Abdome Agudo", criadoEm: agora, atualizadoEm: agora, excluidoEm: null },
    alternativas: null,
  } as unknown as RegistroQuestaoCompleta;
}

type RespostaDaTentativa = TentativaParaConclusao["respostas"][number];

function criarResposta(
  questaoId: string,
  acertou: boolean,
  dificuldade: "FACIL" | "MEDIA" | "DIFICIL" = "FACIL",
): RespostaDaTentativa {
  return {
    questaoId,
    respostaMarcada: acertou ? "B" : "A",
    questao: { respostaCorreta: "B", dificuldade },
  };
}

function criarTentativa(parcial: Partial<TentativaParaConclusao> = {}): TentativaParaConclusao {
  return {
    id: "tentativa-1",
    usuarioId: "aluno-1",
    tema: "Abdome Agudo",
    dificuldade: "FACIL",
    questaoIds: ["q1", "q2", "q3", "q4"],
    totalQuestoes: 4,
    totalAcertos: null,
    status: StatusTentativaQuiz.EM_ANDAMENTO,
    iniciadaEm: agora,
    concluidaEm: null,
    respostas: [],
    transacaoXp: null,
    ...parcial,
  };
}

function criarTransacao(parcial: Partial<TransacaoXpComTentativa> = {}): TransacaoXpComTentativa {
  return {
    id: "xp-1",
    usuarioId: "aluno-1",
    tentativaId: "tentativa-1",
    origem: "QUIZ_CONCLUIDO",
    xpBase: 20,
    bonusDesempenho: 15,
    bonusPowerUp: 0,
    quantidade: 35,
    xpTotalApos: 35,
    xpEloApos: 35,
    criadoEm: agora,
    tentativa: {
      id: "tentativa-1",
      tema: "Abdome Agudo",
      dificuldade: "FACIL",
      totalQuestoes: 4,
      totalAcertos: 3,
    },
    ...parcial,
  };
}

function criarRepositoryMock() {
  return {
    listarIdsQuestoesDisponiveis: jest.fn(),
    buscarQuestoesPorIds: jest.fn(),
    criarTentativa: jest.fn(),
    buscarTentativaParaConclusao: jest.fn(),
    concluirTentativa: jest.fn(),
    buscarXpTotal: jest.fn(),
    buscarDadosProgresso: jest.fn(),
    listarHistoricoXp: jest.fn(),
  } as unknown as jest.Mocked<ProgressaoRepository>;
}

const ATIVO = {
  estado: EstadoElo.ATIVO,
  diasInatividade: 0,
  diasParaAviso: 7,
  ultimaAtividadeEm: null,
  prazoRebaixamentoEm: null,
};

// Estado persistido do aluno: desde a US #89 o elo vem do banco, nao do XP total.
const estadoDe = (xpTotal: number, elo: EloXp, sobrescritas: Record<string, unknown> = {}) => ({
  xpTotal,
  xpElo: xpTotal,
  eloAtual: elo,
  maiorElo: elo,
  ultimaAtividadeEm: null,
  rebaixamentosAplicados: 0,
  ...sobrescritas,
});

describe("ProgressaoService", () => {
  let repository: jest.Mocked<ProgressaoRepository>;
  let service: ProgressaoService;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = criarRepositoryMock();
    service = new ProgressaoService(repository);
    (buscarConfiguracao as jest.Mock).mockResolvedValue({
      diasAviso: 7,
      diasRisco: 8,
      diasRebaixamento: 9,
      diasEntreRebaixamentos: 14,
      indisponibilidades: [],
    });
    (montarRetratoInatividade as jest.Mock).mockReturnValue(ATIVO);
    repository.criarTentativa.mockImplementation(async (usuarioId, filtros, questaoIds) => ({
      id: "tentativa-1",
      usuarioId,
      tema: filtros.tema,
      dificuldade: filtros.dificuldade,
      questaoIds,
      totalQuestoes: questaoIds.length,
      totalAcertos: null,
      status: StatusTentativaQuiz.EM_ANDAMENTO,
      iniciadaEm: agora,
      concluidaEm: null,
    }));
  });

  describe("iniciarTentativa", () => {
    it("usa todas as questoes quando ha menos que o limite (rodada de 4)", async () => {
      const ids = ["q1", "q2", "q3", "q4"];
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue(ids);
      repository.buscarQuestoesPorIds.mockImplementation(async (pedidos) => pedidos.map(criarQuestao));

      const resultado = await service.iniciarTentativa(
        { tema: "Abdome Agudo", dificuldade: "FACIL" },
        "aluno-1",
      );

      expect(resultado.tentativaId).toBe("tentativa-1");
      expect(resultado.totalQuestoes).toBe(4);
      expect(resultado.questoes.map((questao) => questao.id).sort()).toEqual(ids);
      expect(repository.criarTentativa).toHaveBeenCalledWith(
        "aluno-1",
        { tema: "Abdome Agudo", dificuldade: "FACIL" },
        expect.arrayContaining(ids),
      );
    });

    it("limita a rodada a 10 questoes sem repetir nenhuma", async () => {
      const ids = Array.from({ length: 25 }, (_, indice) => `q${indice + 1}`);
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue(ids);
      repository.buscarQuestoesPorIds.mockImplementation(async (pedidos) => pedidos.map(criarQuestao));

      const resultado = await service.iniciarTentativa({}, "aluno-1");

      const idsDaRodada = resultado.questoes.map((questao) => questao.id);
      expect(resultado.totalQuestoes).toBe(10);
      expect(new Set(idsDaRodada).size).toBe(10);
      expect(repository.criarTentativa).toHaveBeenCalledWith(
        "aluno-1",
        { tema: null, dificuldade: null },
        idsDaRodada,
      );
    });

    it("mantem a ordem sorteada mesmo que o banco devolva em outra ordem", async () => {
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue(["q1", "q2", "q3"]);
      repository.buscarQuestoesPorIds.mockImplementation(async (pedidos) =>
        [...pedidos].reverse().map(criarQuestao),
      );

      const resultado = await service.iniciarTentativa({}, "aluno-1");

      const idsGravados = repository.criarTentativa.mock.calls[0][2];
      expect(resultado.questoes.map((questao) => questao.id)).toEqual(idsGravados);
    });

    it("descarta ids sorteados que nao voltaram do banco", async () => {
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue(["q1", "q2"]);
      repository.buscarQuestoesPorIds.mockResolvedValue([criarQuestao("q2")]);

      const resultado = await service.iniciarTentativa({}, "aluno-1");

      expect(resultado.totalQuestoes).toBe(1);
      expect(resultado.questoes[0].id).toBe("q2");
    });

    it("retorna 404 quando nao ha questoes para o filtro", async () => {
      repository.listarIdsQuestoesDisponiveis.mockResolvedValue([]);

      await expect(service.iniciarTentativa({ tema: "Vazio" }, "aluno-1")).rejects.toMatchObject({
        codigoStatus: 404,
        codigo: CodigoDeErro.NAO_ENCONTRADO,
      });
      expect(repository.criarTentativa).not.toHaveBeenCalled();
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.iniciarTentativa({}, "")).rejects.toMatchObject({ codigoStatus: 401 });
    });
  });

  describe("concluirTentativa", () => {
    const respostasCompletas = [
      criarResposta("q1", true),
      criarResposta("q2", true),
      criarResposta("q3", true),
      criarResposta("q4", false),
    ];

    it("conta os acertos no servidor, credita o XP e devolve o resumo", async () => {
      repository.buscarTentativaParaConclusao
        .mockResolvedValueOnce(criarTentativa({ respostas: respostasCompletas }))
        .mockResolvedValueOnce(
          criarTentativa({
            respostas: respostasCompletas,
            status: StatusTentativaQuiz.CONCLUIDA,
            totalAcertos: 3,
            transacaoXp: criarTransacao(),
          }),
        );
      repository.concluirTentativa.mockResolvedValue({ concluidaAgora: true });
      repository.buscarDadosProgresso.mockResolvedValue(estadoDe(35, EloXp.CURIOSO));

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(repository.concluirTentativa).toHaveBeenCalledWith({
        tentativaId: "tentativa-1",
        usuarioId: "aluno-1",
        totalAcertos: 3,
        recompensa: { xpBase: 20, bonusDesempenho: 15, bonusPowerUp: 0, xpTotalRecebido: 35 },
      });
      expect(resultado).toMatchObject({
        missoesConcluidas: [],
        tentativaId: "tentativa-1",
        tema: "Abdome Agudo",
        dificuldade: "FACIL",
        totalQuestoes: 4,
        totalAcertos: 3,
        jaConcluida: false,
        recompensa: { xpBase: 20, bonusDesempenho: 15, bonusPowerUp: 0, xpTotalRecebido: 35 },
        progresso: {
          xpTotal: 35,
          nivel: 1,
          proximoNivel: 2,
          xpNoNivel: 35,
          xpNecessarioNoNivel: 100,
          xpFaltante: 65,
          percentual: 35,
        },
        subiuDeNivel: false,
        nivelAnterior: 1,
        subiuDeElo: false,
        xpExcedenteElo: 35,
      });
      expect(resultado.eloAnterior.nome).toBe("Curioso");
      expect(resultado.novoElo.nome).toBe("Curioso");
    });

    it("sinaliza a subida de nivel e subida de elo quando o XP cruza a fronteira (490 -> 510)", async () => {
      const transacao = criarTransacao({ quantidade: 20, xpTotalApos: 510, xpEloApos: 510 });
      repository.buscarTentativaParaConclusao
        .mockResolvedValueOnce(criarTentativa({ respostas: respostasCompletas }))
        .mockResolvedValueOnce(
          criarTentativa({
            status: StatusTentativaQuiz.CONCLUIDA,
            totalAcertos: 3,
            transacaoXp: transacao,
          }),
        );
      repository.concluirTentativa.mockResolvedValue({ concluidaAgora: true });
      repository.buscarDadosProgresso.mockResolvedValue(estadoDe(510, EloXp.ACADEMICO));

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(resultado.subiuDeElo).toBe(true);
      expect(resultado.eloAnterior.nome).toBe("Curioso");
      expect(resultado.novoElo.nome).toBe("Acadêmico");
      expect(resultado.xpExcedenteElo).toBe(10);
      expect(resultado.progresso.eloAtual.nome).toBe("Acadêmico");
      expect(resultado.progresso.xpFaltanteProximoElo).toBe(990);
    });

    it("usa o elo da epoca e nao sinaliza subiuDeElo quando o credito nao muda de faixa", async () => {
      // Rodada que pagou 20 XP com o aluno ja no R3 (6.500 de XP de elo): nao cruza faixa.
      const transacao = criarTransacao({ quantidade: 20, xpTotalApos: 6500, xpEloApos: 6500 });
      repository.buscarTentativaParaConclusao
        .mockResolvedValueOnce(criarTentativa({ respostas: respostasCompletas }))
        .mockResolvedValueOnce(
          criarTentativa({
            status: StatusTentativaQuiz.CONCLUIDA,
            totalAcertos: 3,
            transacaoXp: transacao,
          }),
        );
      repository.concluirTentativa.mockResolvedValue({ concluidaAgora: true });
      // Aluno no R3 com 6.500 de XP de elo: o credito de 20 XP nao cruza faixa nenhuma.
      repository.buscarDadosProgresso.mockResolvedValue(
        estadoDe(6500, EloXp.R3, { xpElo: 6500, maiorElo: EloXp.R6 }),
      );

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(resultado.eloAnterior.nome).toBe("R3");
      expect(resultado.novoElo.nome).toBe("R3");
      expect(resultado.subiuDeElo).toBe(false);
      // O maior elo conquistado continua preservado no retrato de progresso.
      expect(resultado.progresso.maiorElo.nome).toBe("R6");
    });

    it("na chamada repetida reconstroi o elo da rodada, nao o saldo de hoje", async () => {
      // Rodada antiga: pagou 50 XP e fechou com 1.000 de XP de elo (Academico, sem subir).
      const transacao = criarTransacao({ quantidade: 50, xpTotalApos: 1000, xpEloApos: 1000 });
      repository.buscarTentativaParaConclusao.mockResolvedValue(
        criarTentativa({
          status: StatusTentativaQuiz.CONCLUIDA,
          totalAcertos: 3,
          transacaoXp: transacao,
        }),
      );
      // Depois dela o aluno acumulou ate 3.000 (R1). Repetir a conclusao da rodada antiga
      // nao pode anunciar a subida para R1, que nao foi dela.
      repository.buscarDadosProgresso.mockResolvedValue(estadoDe(3000, EloXp.R1));

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(resultado.jaConcluida).toBe(true);
      expect(resultado.novoElo.nome).toBe("Acadêmico");
      expect(resultado.eloAnterior.nome).toBe("Acadêmico");
      expect(resultado.subiuDeElo).toBe(false);
      // O XP excedente tambem e o da rodada, nao o avanco atual na faixa.
      expect(resultado.xpExcedenteElo).toBe(500);
      // O retrato de progresso continua sendo o estado atual do aluno.
      expect(resultado.progresso.eloAtual.codigo).toBe(EloXp.R1);
    });

    it("nao credita de novo quando a rodada ja estava concluida (refresh/nova requisicao)", async () => {
      repository.buscarTentativaParaConclusao.mockResolvedValue(
        criarTentativa({
          status: StatusTentativaQuiz.CONCLUIDA,
          totalAcertos: 3,
          transacaoXp: criarTransacao(),
        }),
      );
      repository.buscarDadosProgresso.mockResolvedValue(estadoDe(35, EloXp.CURIOSO));

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(repository.concluirTentativa).not.toHaveBeenCalled();
      expect(resultado.jaConcluida).toBe(true);
      expect(resultado.recompensa.xpTotalRecebido).toBe(35);
      expect(resultado.totalAcertos).toBe(3);
    });

    it("marca jaConcluida quando uma requisicao concorrente concluiu primeiro", async () => {
      repository.buscarTentativaParaConclusao
        .mockResolvedValueOnce(criarTentativa({ respostas: respostasCompletas }))
        .mockResolvedValueOnce(
          criarTentativa({
            status: StatusTentativaQuiz.CONCLUIDA,
            totalAcertos: 3,
            transacaoXp: criarTransacao(),
          }),
        );
      repository.concluirTentativa.mockResolvedValue({ concluidaAgora: false });
      repository.buscarDadosProgresso.mockResolvedValue(estadoDe(35, EloXp.CURIOSO));

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(resultado.jaConcluida).toBe(true);
      expect(resultado.recompensa.xpTotalRecebido).toBe(35);
    });

    it("conclui sem XP quando o usuario nao e aluno", async () => {
      repository.buscarTentativaParaConclusao
        .mockResolvedValueOnce(criarTentativa({ respostas: respostasCompletas }))
        .mockResolvedValueOnce(
          criarTentativa({ status: StatusTentativaQuiz.CONCLUIDA, totalAcertos: 3 }),
        );
      repository.concluirTentativa.mockResolvedValue({ concluidaAgora: true });
      repository.buscarDadosProgresso.mockResolvedValue(estadoDe(0, EloXp.CURIOSO));

      const resultado = await service.concluirTentativa("tentativa-1", "prof-1", PAPEIS.PROFESSOR);

      expect(repository.concluirTentativa).toHaveBeenCalledWith(
        expect.objectContaining({ recompensa: null, totalAcertos: 3 }),
      );
      expect(resultado.recompensa).toEqual({
        xpBase: 0,
        bonusDesempenho: 0,
        bonusPowerUp: 0,
        xpTotalRecebido: 0,
      });
      expect(resultado.subiuDeNivel).toBe(false);
      expect(resultado.subiuDeElo).toBe(false);
    });

    it("recusa concluir com questoes pendentes", async () => {
      repository.buscarTentativaParaConclusao.mockResolvedValue(
        criarTentativa({ respostas: [criarResposta("q1", true)] }),
      );

      await expect(
        service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO),
      ).rejects.toMatchObject({
        codigoStatus: 409,
        codigo: CodigoDeErro.CONFLITO,
        message: MENSAGENS.tentativaIncompleta,
        detalhes: { respondidas: 1, totalQuestoes: 4 },
      });
      expect(repository.concluirTentativa).not.toHaveBeenCalled();
    });

    it("retorna 404 para rodada inexistente ou de outro usuario", async () => {
      repository.buscarTentativaParaConclusao.mockResolvedValue(null);

      await expect(
        service.concluirTentativa("nao-existe", "aluno-1", PAPEIS.ALUNO),
      ).rejects.toMatchObject({ codigoStatus: 404, message: MENSAGENS.tentativaNaoEncontrada });
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.concluirTentativa("tentativa-1", "")).rejects.toMatchObject({
        codigoStatus: 401,
      });
    });

    it("trata totalAcertos ausente como zero no resumo", async () => {
      repository.buscarTentativaParaConclusao.mockResolvedValue(
        criarTentativa({ status: StatusTentativaQuiz.CONCLUIDA, totalAcertos: null }),
      );
      repository.buscarDadosProgresso.mockResolvedValue(estadoDe(0, EloXp.CURIOSO));

      const resultado = await service.concluirTentativa("tentativa-1", "aluno-1", PAPEIS.ALUNO);

      expect(resultado.totalAcertos).toBe(0);
    });
  });

  describe("buscarProgresso", () => {
    it("devolve nivel, elo e XP faltante a partir do estado persistido", async () => {
      (aplicarInatividade as jest.Mock).mockResolvedValue({
        dados: { xpTotal: 1200, xpElo: 1200, eloAtual: EloXp.ACADEMICO, maiorElo: EloXp.ACADEMICO },
        retrato: ATIVO,
        rebaixamentos: 0,
        notificacoes: 0,
      });

      await expect(service.buscarProgresso("aluno-1")).resolves.toMatchObject({
        xpTotal: 1200,
        xpElo: 1200,
        eloAtual: expect.objectContaining({ nome: "Acadêmico" }),
        proximoElo: expect.objectContaining({ nome: "Interno" }),
        xpFaltanteProximoElo: 300,
        estadoElo: EstadoElo.ATIVO,
      });
    });

    it("aplica os rebaixamentos vencidos antes de responder e expoe o prazo", async () => {
      const prazo = new Date("2026-11-09T00:00:00.000Z");

      (aplicarInatividade as jest.Mock).mockResolvedValue({
        dados: { xpTotal: 7000, xpElo: 5999, eloAtual: EloXp.R1, maiorElo: EloXp.R3 },
        retrato: {
          estado: EstadoElo.REBAIXADO,
          diasInatividade: 9,
          diasParaAviso: 7,
          ultimaAtividadeEm: new Date("2026-10-17T00:00:00.000Z"),
          prazoRebaixamentoEm: prazo,
        },
        rebaixamentos: 1,
        notificacoes: 2,
      });

      const progresso = await service.buscarProgresso("aluno-1");

      expect(aplicarInatividade).toHaveBeenCalledWith("aluno-1");
      expect(progresso.xpTotal).toBe(7000);
      expect(progresso.xpElo).toBe(5999);
      expect(progresso.eloAtual.codigo).toBe(EloXp.R1);
      expect(progresso.maiorElo.codigo).toBe(EloXp.R3);
      expect(progresso.estadoElo).toBe(EstadoElo.REBAIXADO);
      expect(progresso.prazoRebaixamentoEm).toBe(prazo.toISOString());
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.buscarProgresso("")).rejects.toMatchObject({ codigoStatus: 401 });
    });
  });

  describe("buscarHistoricoElo", () => {
    it("mapeia os eventos de elo com as faixas resolvidas", async () => {
      (listarHistoricoElo as jest.Mock).mockResolvedValue({
        data: [
          {
            id: "evento-1",
            criadoEm: agora,
            tipo: "REBAIXAMENTO",
            eloAnterior: EloXp.R3,
            eloNovo: EloXp.R1,
            xpEloAntes: 7000,
            xpEloDepois: 5999,
            diasInatividade: 9,
          },
        ],
        total: 1,
      });

      const historico = await service.buscarHistoricoElo("aluno-1", {});

      expect(historico.metadados.total).toBe(1);
      expect(historico.dados[0]).toMatchObject({
        id: "evento-1",
        data: agora.toISOString(),
        tipo: "REBAIXAMENTO",
        xpEloAntes: 7000,
        xpEloDepois: 5999,
        diasInatividade: 9,
      });
      expect(historico.dados[0].eloAnterior.nome).toBe("R3");
      expect(historico.dados[0].eloNovo.nome).toBe("R1");
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.buscarHistoricoElo("", {})).rejects.toMatchObject({
        codigoStatus: 401,
      });
    });
  });

  describe("notificacoes de elo", () => {
    it("gera os avisos pendentes e mapeia a lista do proprio aluno", async () => {
      (aplicarInatividade as jest.Mock).mockResolvedValue({
        dados: { xpTotal: 0, xpElo: 0, eloAtual: EloXp.CURIOSO, maiorElo: EloXp.CURIOSO },
        retrato: ATIVO,
        rebaixamentos: 0,
        notificacoes: 1,
      });
      (listarNotificacoes as jest.Mock).mockResolvedValue([
        {
          id: "aviso-1",
          criadoEm: agora,
          tipo: "ELO_EM_RISCO",
          titulo: "Seu elo está em risco",
          mensagem: "mensagem",
          eloRelacionado: EloXp.R3,
          prazoRebaixamentoEm: agora,
          lidaEm: null,
        },
      ]);

      const notificacoes = await service.buscarNotificacoes("aluno-1", true);

      expect(aplicarInatividade).toHaveBeenCalledWith("aluno-1");
      expect(listarNotificacoes).toHaveBeenCalledWith("aluno-1", true);
      expect(notificacoes[0]).toEqual({
        id: "aviso-1",
        data: agora.toISOString(),
        tipo: "ELO_EM_RISCO",
        titulo: "Seu elo está em risco",
        mensagem: "mensagem",
        eloRelacionado: EloXp.R3,
        prazoRebaixamentoEm: agora.toISOString(),
        lida: false,
      });
    });

    it("marca o aviso como lido", async () => {
      (marcarNotificacaoLida as jest.Mock).mockResolvedValue(true);

      await expect(service.marcarNotificacaoLida("aviso-1", "aluno-1")).resolves.toBeUndefined();
      expect(marcarNotificacaoLida).toHaveBeenCalledWith("aviso-1", "aluno-1");
    });

    it("retorna 404 ao marcar aviso de outro aluno", async () => {
      (marcarNotificacaoLida as jest.Mock).mockResolvedValue(false);

      await expect(service.marcarNotificacaoLida("aviso-1", "aluno-1")).rejects.toMatchObject({
        codigoStatus: 404,
      });
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.buscarNotificacoes("")).rejects.toMatchObject({ codigoStatus: 401 });
    });
  });

  describe("rotina e configuracao de inatividade", () => {
    it("delega a varredura em lote sem receber identificador de usuario", async () => {
      (aplicarInatividadeEmLote as jest.Mock).mockResolvedValue({
        avaliados: 3,
        rebaixamentos: 1,
        notificacoes: 4,
        pendentes: false,
      });

      await expect(service.verificarInatividade()).resolves.toEqual({
        avaliados: 3,
        rebaixamentos: 1,
        notificacoes: 4,
        pendentes: false,
      });
      expect(aplicarInatividadeEmLote).toHaveBeenCalledWith();
    });

    it("converte a linha de configuracao para o DTO", async () => {
      const linha = {
        diasAviso: 7,
        diasRisco: 8,
        diasRebaixamento: 9,
        diasEntreRebaixamentos: 14,
        indisponibilidades: [{ inicio: "2026-10-01T00:00:00.000Z", fim: "2026-10-02T00:00:00.000Z" }],
        atualizadoPorId: "admin-1",
        atualizadoEm: agora,
      };
      (buscarConfiguracaoCompleta as jest.Mock).mockResolvedValue(linha);

      await expect(service.buscarConfiguracaoInatividade()).resolves.toEqual({
        ...linha,
        atualizadoEm: agora.toISOString(),
      });
    });

    it("trata indisponibilidades invalidas como lista vazia", async () => {
      (buscarConfiguracaoCompleta as jest.Mock).mockResolvedValue({
        diasAviso: 7,
        diasRisco: 8,
        diasRebaixamento: 9,
        diasEntreRebaixamentos: 14,
        indisponibilidades: "nao-e-lista",
        atualizadoPorId: null,
        atualizadoEm: agora,
      });

      const configuracao = await service.buscarConfiguracaoInatividade();

      expect(configuracao.indisponibilidades).toEqual([]);
    });

    it("registra quem alterou os prazos", async () => {
      const dados = {
        diasAviso: 10,
        diasRisco: 12,
        diasRebaixamento: 15,
        diasEntreRebaixamentos: 20,
        indisponibilidades: [],
      };
      (salvarConfiguracao as jest.Mock).mockResolvedValue({
        ...dados,
        atualizadoPorId: "admin-1",
        atualizadoEm: agora,
      });

      await expect(
        service.salvarConfiguracaoInatividade(dados, "admin-1"),
      ).resolves.toMatchObject({ diasAviso: 10, atualizadoPorId: "admin-1" });
      expect(salvarConfiguracao).toHaveBeenCalledWith(dados, "admin-1");
    });

    it("retorna 401 ao salvar sem usuario autenticado", async () => {
      await expect(
        service.salvarConfiguracaoInatividade(
          {
            diasAviso: 7,
            diasRisco: 8,
            diasRebaixamento: 9,
            diasEntreRebaixamentos: 14,
            indisponibilidades: [],
          },
          "",
        ),
      ).rejects.toMatchObject({ codigoStatus: 401 });
    });
  });

  describe("buscarHistoricoXp", () => {
    it("mapeia data, origem, quiz relacionado e valor", async () => {
      repository.listarHistoricoXp.mockResolvedValue({
        data: [
          criarTransacao(),
          criarTransacao({ id: "xp-2", tentativaId: null, tentativa: null }),
          criarTransacao({
            id: "xp-3",
            tentativa: {
              id: "tentativa-3",
              tema: null,
              dificuldade: null,
              totalQuestoes: 2,
              totalAcertos: null,
            },
          }),
        ],
        total: 3,
      });

      const resultado = await service.buscarHistoricoXp("aluno-1", { page: 1, limit: 10 });

      expect(repository.listarHistoricoXp).toHaveBeenCalledWith("aluno-1", {
        page: 1,
        limit: 10,
        skip: 0,
      });
      expect(resultado.dados[0]).toEqual({
        id: "xp-1",
        data: "2026-10-09T12:00:00.000Z",
        origem: "QUIZ_CONCLUIDO",
        missao: null,
        quiz: {
          tentativaId: "tentativa-1",
          tema: "Abdome Agudo",
          dificuldade: "FACIL",
          totalQuestoes: 4,
          totalAcertos: 3,
        },
        xpBase: 20,
        bonusDesempenho: 15,
        bonusPowerUp: 0,
        valor: 35,
      });
      expect(resultado.dados[1].quiz).toBeNull();
      expect(resultado.dados[2].quiz?.totalAcertos).toBe(0);
      expect(resultado.metadados).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
    });

    it("retorna 401 sem usuario autenticado", async () => {
      await expect(service.buscarHistoricoXp("", {})).rejects.toMatchObject({ codigoStatus: 401 });
    });
  });
});
