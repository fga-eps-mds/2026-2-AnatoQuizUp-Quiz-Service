import { bloquearMissoes, contabilizarResposta } from "@/modules/missoes/missoes.repository";
import type {
  FiltroListarQuestoesQueryDto,
  RegistroQuestaoCompleta,
} from "@/modules/questoes/dto/question.types";
import { montarFiltroPrisma } from "@/modules/questoes/dto/question.types";
import { prisma } from "@/config/db";
import type { ParametrosPaginacao } from "@/shared/utils/paginacao.util";
import type { ResponderQuestaoQuizDto } from "./dto/requests/responder_questao_quiz_dto";
import { FonteMoeda, Prisma } from "@prisma/client";
import { MENSAGENS } from "@/shared/constants/mensagens";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";

// Repository do quiz (Prisma): consulta questoes para o quiz, registra tentativas,
// concede moedas por acerto e monta o historico de respostas do usuario.

// Projecao da questao com tema e alternativas (usada ao montar o quiz).
const includeQuestaoCompleta = {
  tema: true,
  alternativas: true,
};

// Projecao do historico: a resolucao + a questao com tema e alternativas.
const selectListarQuestoesRespondidas = {
  id: true,
  questaoId: true,
  respostaMarcada: true,
  criadoEm: true,
  questao: {
    select: {
      enunciado: true,
      tipoQuestao: true,
      respostaCorreta: true,
      saibaMais: true,
      status: true,
      origemQuestao: true,
      urlImagem: true,
      dificuldade: true,
      tema: { select: { id: true, nome: true } },
      alternativas: {
        select: {
          alternativaA: true,
          alternativaB: true,
          alternativaC: true,
          alternativaD: true,
          alternativaE: true,
        },
      },
    },
  },
};

export class QuizRepository {
  /**
   * Busca questoes (ativas) que atendem aos filtros, paginadas, com tema/alternativas.
   *
   * @param paginacao Parametros de paginacao (skip/take).
   * @param filtros Filtros de tema/dificuldade/tipo.
   * @returns Pagina de questoes completas e o total de questoes filtradas.
   */
  async filtrarQuestoesQuiz(paginacao: ParametrosPaginacao, filtros: FiltroListarQuestoesQueryDto) {
    const where = montarFiltroPrisma(filtros);

    // Filtro de tema por nome (case-insensitive), alem dos filtros base.
    if (filtros.tema) {
      where.tema = { nome: { equals: filtros.tema, mode: "insensitive" } };
    }
    // So entram no quiz questoes ativas e nao excluidas.
    where.status = "ATIVO";
    where.excluidoEm = null;

    const [data, total] = await prisma.$transaction([
      prisma.questao.findMany({
        where,
        include: includeQuestaoCompleta,
        skip: paginacao.skip,
        take: paginacao.limit,
      }),
      prisma.questao.count({ where }),
    ]);

    return { data: data as RegistroQuestaoCompleta[], total };
  }

  /**
   * Registra a tentativa do usuario (uma linha de resolucao por resposta).
   *
   * Quando a resposta pertence a uma rodada, grava o tentativaId. A chave unica
   * (tentativaId, questaoId) impede responder a mesma questao duas vezes na rodada.
   *
   * @param data Resposta enviada (questao, tipo, alternativa e rodada opcional).
   * @param usuarioId Aluno que respondeu.
   * @returns A resolucao criada.
   * @throws ErroAplicacao 409 se a questao ja foi respondida nesta rodada.
   */
  async registrarTentativa(data: ResponderQuestaoQuizDto, usuarioId: string, correta?: boolean) {
    try {
      if (correta === undefined) {
        const resolucao = await prisma.resolucaoQuestao.create({
          data: {
            respostaMarcada: data.respostaMarcada,
            questaoId: data.questaoId,
            usuarioId,
            ...(data.tentativaId && { tentativaId: data.tentativaId }),
          },
        });
        return { ...resolucao, missoesConcluidas: [] };
      }
      return await prisma.$transaction(async (tx) => {
        if (correta !== undefined) await bloquearMissoes(tx, usuarioId);
        const agora = new Date();
        const resolucao = await tx.resolucaoQuestao.create({
          data: {
            respostaMarcada: data.respostaMarcada,
            questaoId: data.questaoId,
            usuarioId: usuarioId,
            ...(data.tentativaId && { tentativaId: data.tentativaId }),
            criadoEm: agora,
          },
        });
        const missoesConcluidas = await contabilizarResposta(
          tx,
          usuarioId,
          data.questaoId,
          correta,
          agora,
        );
        return { ...resolucao, missoesConcluidas };
      });
    } catch (error) {
      // Duas requisicoes simultaneas para a mesma questao da rodada: a segunda cai aqui.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ErroAplicacao({
          codigoStatus: 409,
          codigo: CodigoDeErro.CONFLITO,
          mensagem: MENSAGENS.questaoJaRespondidaNaTentativa,
        });
      }
      throw error;
    }
  }

  /**
   * Busca a rodada do usuario com o minimo para validar uma resposta: status,
   * questoes da rodada e se a questao informada ja foi respondida nela.
   *
   * @param tentativaId Id da rodada.
   * @param usuarioId Dono esperado da rodada.
   * @param questaoId Questao que esta sendo respondida.
   * @returns Dados da rodada, ou null se nao existir/nao for do usuario.
   */
  async buscarTentativaParaResposta(tentativaId: string, usuarioId: string, questaoId: string) {
    return await prisma.tentativaQuiz.findFirst({
      where: { id: tentativaId, usuarioId },
      select: {
        status: true,
        questaoIds: true,
        respostas: { where: { questaoId, excluidoEm: null }, select: { id: true } },
      },
    });
  }

  /**
   * Busca o gabarito da questao (resposta correta + metadados para o feedback).
   *
   * @param id Id da questao.
   * @returns Resposta correta, dificuldade e tema, ou null se nao encontrada.
   */
  async buscarResposta(id: string) {
    return await prisma.questao.findUnique({
      where: { id, excluidoEm: null },
      select: {
        respostaCorreta: true,
        saibaMais: true,
        dificuldade: true,
        temaId: true,
        tema: true,
      },
    });
  }

  /**
   * Saldo de moedas do usuario (0 se ainda nao tem carteira).
   *
   * @param usuarioId Id do usuario.
   * @returns Saldo atual de moedas.
   */
  async buscarSaldoMoedas(usuarioId: string) {
    const carteira = await prisma.carteiraMoedas.findUnique({
      where: { usuarioId },
      select: { saldo: true },
    });

    return carteira?.saldo ?? 0;
  }

  /**
   * Credita moedas por acerto, garantindo pagamento unico por questao.
   *
   * Numa transacao: garante a carteira, tenta registrar a transacao de moedas com
   * skipDuplicates (questaoId + fonte) e so incrementa o saldo se ela foi criada
   * agora. Se ja existia, retorna moedasJaConcedidas = true sem creditar de novo.
   *
   * @param usuarioId Aluno que acertou.
   * @param questaoId Questao acertada (chave da idempotencia).
   * @param quantidade Moedas a conceder.
   * @returns Moedas concedidas, saldo atual e se ja havia sido concedido antes.
   */
  async concederMoedasPorAcerto(usuarioId: string, questaoId: string, quantidade: number) {
    return await prisma.$transaction(async (tx) => {
      // Garante a carteira do usuario antes de creditar.
      await tx.carteiraMoedas.upsert({
        where: { usuarioId },
        create: { usuarioId, saldo: 0 },
        update: {},
      });

      // Idempotente: duplicado (mesma questao/fonte) e ignorado.
      const transacao = await tx.transacaoMoeda.createMany({
        data: [
          {
            usuarioId,
            questaoId,
            quantidade,
            fonte: FonteMoeda.ACERTO_QUESTAO,
          },
        ],
        skipDuplicates: true,
      });

      // Nada criado = ja havia recompensa por esta questao; nao credita de novo.
      if (transacao.count === 0) {
        const carteira = await tx.carteiraMoedas.findUnique({
          where: { usuarioId },
          select: { saldo: true },
        });

        return {
          moedasConcedidas: 0,
          saldoMoedas: carteira?.saldo ?? 0,
          moedasJaConcedidas: true,
        };
      }

      const carteiraAtualizada = await tx.carteiraMoedas.update({
        where: { usuarioId },
        data: { saldo: { increment: quantidade } },
        select: { saldo: true },
      });

      return {
        moedasConcedidas: quantidade,
        saldoMoedas: carteiraAtualizada.saldo,
        moedasJaConcedidas: false,
      };
    });
  }

  /**
   * Conta as questoes que atendem aos filtros (base para o sorteio aleatorio do quiz).
   *
   * @param filtros Filtros de tema/dificuldade/tipo.
   * @returns Total de questoes ativas que satisfazem os filtros.
   */
  async contarQuestoesQuiz(filtros: FiltroListarQuestoesQueryDto) {
    const where = montarFiltroPrisma(filtros);

    if (filtros.tema) {
      where.tema = { nome: { equals: filtros.tema, mode: "insensitive" } };
    }
    where.status = "ATIVO";
    where.excluidoEm = null;

    return await prisma.questao.count({ where });
  }

  /**
   * Lista temas que tem questoes ativas, com a dificuldade de cada e a contagem total.
   *
   * @returns Temas com suas questoes (dificuldade) e o total por tema.
   */
  async buscarQuantidadeDeQuestoesPorTema() {
    return await prisma.tema.findMany({
      where: { questoes: { some: { status: "ATIVO", excluidoEm: null } } },
      select: {
        nome: true,
        questoes: {
          where: { status: "ATIVO", excluidoEm: null },
          select: { dificuldade: true },
        },
        _count: {
          select: { questoes: { where: { status: "ATIVO", excluidoEm: null } } },
        },
      },
    });
  }

  /**
   * Lista paginada das resolucoes do usuario (historico), com filtros opcionais por
   * tema/dificuldade/tipo, mais recentes primeiro.
   *
   * @param usuarioId Id do usuario.
   * @param paginacao Parametros de paginacao (skip/take).
   * @param filtros Filtros opcionais de tema/dificuldade/tipo.
   * @returns Pagina de resolucoes e o total filtrado.
   */
  async listarQuestoesRespondidas(
    usuarioId: string,
    paginacao: ParametrosPaginacao,
    filtros: FiltroListarQuestoesQueryDto,
  ) {
    if (filtros.somenteErros) {
      const condicoes = [
        Prisma.sql`r."usuarioId" = ${usuarioId}`,
        Prisma.sql`r."excluidoEm" IS NULL`,
        Prisma.sql`q."excluidoEm" IS NULL`,
        Prisma.sql`q."status" = 'ATIVO'`,
        Prisma.sql`r."respostaMarcada" <> q."respostaCorreta"`,
      ];
      if (filtros.tema) {
        condicoes.push(Prisma.sql`LOWER(t."nome") = LOWER(${filtros.tema})`);
      }
      if (filtros.dificuldade) {
        condicoes.push(Prisma.sql`q."dificuldade"::text = ${filtros.dificuldade}`);
      }
      if (filtros.tipo) {
        condicoes.push(Prisma.sql`q."tipoQuestao"::text = ${filtros.tipo}`);
      }
      const filtro = Prisma.join(condicoes, " AND ");
      const base = Prisma.sql`FROM "resolucoes_questoes" r
        JOIN "questoes" q ON q."id" = r."questaoId"
        JOIN "temas" t ON t."id" = q."temaId"
        WHERE ${filtro}`;
      const [ids, contagem] = await Promise.all([
        prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT r."id" ${base}
          ORDER BY r."criadoEm" DESC, r."id" DESC
          LIMIT ${paginacao.limit} OFFSET ${paginacao.skip}`),
        prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
          SELECT COUNT(*)::int AS total ${base}`),
      ]);
      if (ids.length === 0) return { data: [], total: contagem[0]?.total ?? 0 };
      const registros = await prisma.resolucaoQuestao.findMany({
        where: { id: { in: ids.map((item) => item.id) } },
        select: selectListarQuestoesRespondidas,
      });
      const porId = new Map(registros.map((item) => [item.id, item]));
      return {
        data: ids.flatMap((item) => {
          const registro = porId.get(item.id);
          return registro ? [registro] : [];
        }),
        total: contagem[0]?.total ?? 0,
      };
    }
    const where: Prisma.ResolucaoQuestaoWhereInput = {
      usuarioId,
      excluidoEm: null,
      questao: {
        excluidoEm: null,
        status: "ATIVO",
        ...(filtros.tema && {
          tema: { nome: { equals: filtros.tema, mode: "insensitive" } },
        }),
        ...(filtros.dificuldade && { dificuldade: filtros.dificuldade }),
        ...(filtros.tipo && { tipoQuestao: filtros.tipo }),
      },
    };

    const [data, total] = await prisma.$transaction([
      prisma.resolucaoQuestao.findMany({
        where,
        select: selectListarQuestoesRespondidas,
        skip: paginacao.skip,
        take: paginacao.limit,
        orderBy: { criadoEm: "desc" },
      }),
      prisma.resolucaoQuestao.count({ where }),
    ]);

    return { data, total };
  }
}
