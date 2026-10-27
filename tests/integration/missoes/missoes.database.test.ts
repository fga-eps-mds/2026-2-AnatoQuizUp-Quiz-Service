jest.mock("puppeteer", () => ({}));
import jwt from "jsonwebtoken";
import request from "supertest";
import { aplicacao } from "@/config/app";
import { QuizRepository } from "@/modules/quiz/quiz.repository";
import { ProgressaoRepository } from "@/modules/progressao/progressao.repository";
import { ProgressaoService } from "@/modules/progressao/progressao.service";
import { TIPO_QUESTAO_API } from "@/modules/questoes/dto/question.types";
import { prisma } from "@/config/db";
import {
  bloquearMissoes,
  contabilizarResposta,
  contabilizarQuiz,
  listarMissoes,
} from "@/modules/missoes/missoes.repository";
import { periodoDiario } from "@/modules/missoes/periodo";

// Executado apenas contra banco de teste explicitamente informado.
const suite = process.env.MISSOES_DATABASE_TEST_URL ? describe : describe.skip;
suite("missões diárias no PostgreSQL", () => {
  const usuario = `teste-missoes-${Date.now()}`;
  const agora = new Date();
  const registrar = (questao: string, correta: boolean, instante = agora) =>
    prisma.$transaction(async (tx) => {
      await bloquearMissoes(tx, usuario);
      await contabilizarResposta(tx, usuario, questao, correta, instante);
    });
  afterAll(async () => {
    const usuarios = [usuario, `${usuario}-resposta`, `${usuario}-rollback`, `${usuario}-rodada`];
    await prisma.transacaoXp.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.progressoXp.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.eventoMissao.deleteMany({ where: { periodo: { usuarioId: { in: usuarios } } } });
    await prisma.missaoUsuario.deleteMany({ where: { periodo: { usuarioId: { in: usuarios } } } });
    await prisma.periodoMissoes.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.resolucaoQuestao.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.tentativaQuiz.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.questao.deleteMany({ where: { criadoPorId: "professor", tema: { nome: "Tema de teste" } } });
    await prisma.tema.deleteMany({ where: { nome: "Tema de teste" } });
    await prisma.$disconnect();
  });

  it("exige autenticação e considera somente o usuário do token", async () => {
    const token = jwt.sign(
      { id: usuario, papel: "ALUNO", status: "ATIVO" },
      process.env.JWT_SECRET_KEY!,
    );
    const semToken = await request(aplicacao)
      .get("/api/v1/missoes/minhas")
      .set("x-internal-token", process.env.INTERNAL_TOKEN!);
    expect(semToken.status).toBe(401);
    const resposta = await request(aplicacao)
      .get("/api/v1/missoes/minhas?usuarioId=outro")
      .set("x-internal-token", process.env.INTERNAL_TOKEN!)
      .set("x-user-id", "outro")
      .set("Authorization", `Bearer ${token}`);
    expect(resposta.status).toBe(200);
    expect(resposta.body.missoes).toHaveLength(3);
    const professor = jwt.sign(
      { id: "professor-84", papel: "PROFESSOR", status: "ATIVO" },
      process.env.JWT_SECRET_KEY!,
    );
    const negado = await request(aplicacao)
      .get("/api/v1/missoes/minhas")
      .set("x-internal-token", process.env.INTERNAL_TOKEN!)
      .set("Authorization", `Bearer ${professor}`);
    expect(negado.status).toBe(403);
    expect(await prisma.periodoMissoes.count({ where: { usuarioId: "professor-84" } })).toBe(0);
  });

  it("atribui exatamente três missões, mesmo em consultas concorrentes", async () => {
    const [a, b] = await Promise.all([listarMissoes(usuario), listarMissoes(usuario)]);
    expect(a.missoes).toHaveLength(3);
    expect(a.missoes.map((m) => m.id)).toEqual(b.missoes.map((m) => m.id));
  });

  it("considera só a primeira resposta e credita a missão uma vez", async () => {
    const { inicio } = periodoDiario(agora);
    const periodo = await prisma.periodoMissoes.findFirstOrThrow({
      where: { usuarioId: usuario, periodicidade: "DIARIA", inicio },
    });
    await prisma.missaoUsuario.deleteMany({ where: { periodoId: periodo.id } });
    const catalogo = await prisma.missaoCatalogo.findUniqueOrThrow({
      where: { codigo: "BONS_ACERTOS" },
    });
    await prisma.missaoUsuario.create({ data: { periodoId: periodo.id, missaoId: catalogo.id } });
    await registrar("erro-inicial", false);
    await registrar("erro-inicial", true);
    await Promise.all(Array.from({ length: 8 }, (_, i) => registrar(`certa-${i % 5}`, true)));
    const missao = await prisma.missaoUsuario.findFirstOrThrow({
      where: { periodoId: periodo.id },
      include: { transacaoXp: true },
    });
    expect(missao.progresso).toBe(5);
    expect(missao.transacaoXp?.quantidade).toBe(30);
    expect(await prisma.transacaoXp.count({ where: { usuarioId: usuario } })).toBe(1);
    expect(
      (await prisma.progressoXp.findUniqueOrThrow({ where: { usuarioId: usuario } })).xpTotal,
    ).toBe(30);
    const historico = await new ProgressaoService(new ProgressaoRepository()).buscarHistoricoXp(
      usuario,
      {},
    );
    expect(historico.dados[0]).toMatchObject({
      origem: "MISSAO_CONCLUIDA",
      valor: 30,
      missao: { codigo: "BONS_ACERTOS", nome: "Bons acertos" },
    });
  });

  it("grava a resposta e o progresso juntos e desfaz ambos em caso de falha", async () => {
    const aluno = `${usuario}-resposta`;
    const tema = await prisma.tema.create({ data: { nome: "Tema de teste" } });
    const questao = await prisma.questao.create({
      data: {
        enunciado: "Teste",
        tipoQuestao: "MULTIPLA_ESCOLHA",
        respostaCorreta: "A",
        criadoPorId: "professor",
        temaId: tema.id,
      },
    });
    const repository = new QuizRepository();
    await repository.registrarTentativa(
      { questaoId: questao.id, tipo: TIPO_QUESTAO_API.MULTIPLA_ESCOLHA, respostaMarcada: "A" },
      aluno,
      true,
    );
    expect(await prisma.resolucaoQuestao.count({ where: { usuarioId: aluno } })).toBe(1);
    expect(
      await prisma.eventoMissao.count({
        where: { periodo: { usuarioId: aluno, periodicidade: "DIARIA" }, chave: questao.id },
      }),
    ).toBe(1);
    const alunoFalha = `${usuario}-rollback`;
    await expect(
      prisma.$transaction(async (tx) => {
        await bloquearMissoes(tx, alunoFalha);
        await tx.resolucaoQuestao.create({
          data: { usuarioId: alunoFalha, questaoId: questao.id, respostaMarcada: "A" },
        });
        await contabilizarResposta(tx, alunoFalha, questao.id, true, agora);
        throw new Error("falha simulada");
      }),
    ).rejects.toThrow("falha simulada");
    expect(await prisma.resolucaoQuestao.count({ where: { usuarioId: alunoFalha } })).toBe(0);
    expect(await prisma.periodoMissoes.count({ where: { usuarioId: alunoFalha } })).toBe(0);
  });

  it("conclui uma rodada concorrente uma vez e registra um evento", async () => {
    const aluno = `${usuario}-rodada`;
    const tentativa = await prisma.tentativaQuiz.create({
      data: {
        usuarioId: aluno,
        questaoIds: [],
        totalQuestoes: 0,
        tema: "Cardio",
        dificuldade: "FACIL",
      },
    });
    const repository = new ProgressaoRepository();
    const params = {
      tentativaId: tentativa.id,
      usuarioId: aluno,
      totalAcertos: 0,
      recompensa: { xpBase: 5, bonusDesempenho: 0, bonusPowerUp: 0, xpTotalRecebido: 5 },
    };
    const resultados = await Promise.all([
      repository.concluirTentativa(params),
      repository.concluirTentativa(params),
    ]);
    expect(resultados.filter((r) => r.concluidaAgora)).toHaveLength(1);
    expect(
      await prisma.transacaoXp.count({ where: { usuarioId: aluno, origem: "QUIZ_CONCLUIDO" } }),
    ).toBe(1);
    expect(
      await prisma.eventoMissao.count({
        where: { periodo: { usuarioId: aluno, periodicidade: "DIARIA" }, tipo: "QUIZ" },
      }),
    ).toBe(1);
  });

  it("não carrega atividades para o dia seguinte e deduplica combinações de quiz", async () => {
    const amanha = new Date(periodoDiario(agora).fim.getTime() + 1000);
    await prisma.$transaction(async (tx) => {
      await bloquearMissoes(tx, usuario);
      await contabilizarQuiz(tx, usuario, "Cardio", "FACIL", amanha);
      await contabilizarQuiz(tx, usuario, "cardio", "FACIL", amanha);
    });
    const periodo = await prisma.periodoMissoes.findFirstOrThrow({
      where: { usuarioId: usuario, periodicidade: "DIARIA", inicio: periodoDiario(amanha).inicio },
      include: { eventos: true },
    });
    expect(periodo.eventos).toHaveLength(1);
    expect(periodo.eventos[0].tipo).toBe("QUIZ");
  });
});
