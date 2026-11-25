import { prisma } from "@/config/db";
import { QuestionRepository } from "../../../src/modules/questoes/questoes.repository";

jest.mock("@/config/db", () => ({
  prisma: {
    $transaction: jest.fn(),
    questao: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const transactionMock = prisma.$transaction as jest.Mock;
const findManyMock = prisma.questao.findMany as jest.Mock;
const countMock = prisma.questao.count as jest.Mock;
const findFirstMock = prisma.questao.findFirst as jest.Mock;
const updateMock = prisma.questao.update as jest.Mock;

describe("QuestionRepository", () => {
  let repository: QuestionRepository;

  beforeEach(() => {
    repository = new QuestionRepository();
    jest.clearAllMocks();
  });

  test("lista questoes ativas com paginacao", async () => {
    const registros = [{ id: "questao-1" }];
    transactionMock.mockResolvedValue([registros, 1]);

    const resposta = await repository.listar({ page: 1, limit: 10, skip: 0 });

    expect(prisma.questao.findMany).toHaveBeenCalledWith({
      where: { excluidoEm: null },
      include: { tema: true, alternativas: true },
      skip: 0,
      take: 10,
      orderBy: { criadoEm: "desc" },
    });
    expect(prisma.questao.count).toHaveBeenCalledWith({ where: { excluidoEm: null } });
    expect(transactionMock).toHaveBeenCalledWith([
      findManyMock.mock.results[0]?.value,
      countMock.mock.results[0]?.value,
    ]);
    expect(resposta).toEqual({ data: registros, total: 1 });
  });

  test("busca questao ativa por id", async () => {
    findFirstMock.mockResolvedValue({ id: "questao-1" });

    const resposta = await repository.buscarPorId("questao-1");

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "questao-1", excluidoEm: null },
      include: { tema: true, alternativas: true },
    });
    expect(resposta).toEqual({ id: "questao-1" });
  });

  test("deve filtrar questoes por tema, dificuldade e tipo com paginacao", async () => {
    const registros = [{ id: "questao-filtrada-1" }];
    const totalRegistros = 1;

    transactionMock.mockResolvedValue([registros, totalRegistros]);

    const filtros = {
      tema: "Sistema Cardiovascular",
      dificuldade: "MEDIA",
      tipo: "MULTIPLA_ESCOLHA",
    };

    const paginacao = { skip: 0, limit: 5 };

    const resposta = await repository.filtrar(paginacao, filtros);

    expect(prisma.questao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ATIVO",
          excluidoEm: null,
          dificuldade: "MEDIA",
          tipoQuestao: "MULTIPLA_ESCOLHA",
          tema: {
            nome: {
              contains: "Sistema Cardiovascular",
              mode: "insensitive",
            },
          },
        }),
        skip: 0,
        take: 5,
      }),
    );

    expect(prisma.questao.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ATIVO",
          dificuldade: "MEDIA",
        }),
      }),
    );

    expect(resposta).toEqual({ data: registros, total: totalRegistros });
  });

  test("cria questao e tema quando tema ainda nao existe", async () => {
    const tema = { id: "tema-1", nome: "Anatomia" };
    const questao = { id: "questao-1" };
    const transacao = {
      tema: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(tema),
      },
      questao: {
        create: jest.fn().mockResolvedValue(questao),
      },
    };
    transactionMock.mockImplementation((callback) => callback(transacao));

    const resposta = await repository.criar(
      {
        tema: "Anatomia",
        enunciado: "Enunciado",
        tipo: "MULTIPLA_ESCOLHA",
        dificuldade: "DIFICIL",
        imagem: "https://cdn.example.com/imagem.png",
        alternativaCorreta: "A",
        saibaMais: "Explicacao",
        alternativas: { A: "A", B: "B", C: "C", D: "D", E: "E" },
      },
      "professor-1",
    );

    expect(transacao.tema.findFirst).toHaveBeenCalledWith({
      where: { nome: "Anatomia", excluidoEm: null },
    });
    expect(transacao.tema.create).toHaveBeenCalledWith({ data: { nome: "Anatomia" } });
    expect(transacao.questao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoQuestao: "MULTIPLA_ESCOLHA",
          respostaCorreta: "A",
          criadoPorId: "professor-1",
          temaId: "tema-1",
        }),
        include: { tema: true, alternativas: true },
      }),
    );
    expect(resposta).toMatchObject({questao: questao, temaCriado: true});
  });

  test("cria questao do tipo certo-errado usando apenas as alternativas C e E", async () => {
    const tema = { id: "tema-1", nome: "Anatomia" };
    const questao = { id: "questao-1" };
    const transacao = {
      tema: {
        findFirst: jest.fn().mockResolvedValue(tema),
        create: jest.fn(),
      },
      questao: {
        create: jest.fn().mockResolvedValue(questao),
      },
    };
    transactionMock.mockImplementation((callback) => callback(transacao));

    await repository.criar(
      {
        tema: "Anatomia",
        enunciado: "Enunciado",
        tipo: "CERTO_ERRADO",
        dificuldade: "FACIL",
        imagem: "https://cdn.example.com/imagem.png",
        alternativaCorreta: "C",
        saibaMais: "Explicacao",
        alternativas: { C: "Certo", E: "Errado" },
      },
      "professor-1",
    );

    expect(transacao.questao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alternativas: {
            create: {
              alternativaA: "",
              alternativaB: "",
              alternativaC: "Certo",
              alternativaD: "",
              alternativaE: "Errado",
            },
          },
        }),
      }),
    );
  });

  test("criar persiste os campos de classificacao e usa default de origemQuestao quando ausente", async () => {
    const tema = { id: "tema-1", nome: "Anatomia" };
    const transacao = {
      tema: {
        findFirst: jest.fn().mockResolvedValue(tema),
        create: jest.fn(),
      },
      questao: {
        create: jest.fn().mockResolvedValue({ id: "questao-1" }),
      },
    };
    transactionMock.mockImplementation((callback) => callback(transacao));

    await repository.criar(
      {
        tema: "Anatomia",
        enunciado: "Enunciado",
        tipo: "MULTIPLA_ESCOLHA",
        dificuldade: "DIFICIL",
        imagem: "https://cdn.example.com/imagem.png",
        alternativaCorreta: "A",
        saibaMais: "Explicacao",
        taxonomiaBloom: "ANALISAR",
        regiaoAnatomica: "Tórax",
        alternativas: { A: "A", B: "B", C: "C", D: "D", E: "E" },
      },
      "professor-1",
    );

    expect(transacao.questao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxonomiaBloom: "ANALISAR",
          regiaoAnatomica: "Tórax",
          origemQuestao: undefined, // ausente → Prisma aplica o default do schema
        }),
      }),
    );
  });

  test("criar normaliza palavras-chave em string (split, trim e dedupe)", async () => {
    const tema = { id: "tema-1", nome: "Anatomia" };
    const transacao = {
      tema: { findFirst: jest.fn().mockResolvedValue(tema), create: jest.fn() },
      questao: { create: jest.fn().mockResolvedValue({ id: "questao-1" }) },
    };
    transactionMock.mockImplementation((callback) => callback(transacao));

    await repository.criar(
      {
        tema: "Anatomia",
        enunciado: "Enunciado",
        tipo: "MULTIPLA_ESCOLHA",
        dificuldade: "FACIL",
        imagem: "",
        alternativaCorreta: "A",
        saibaMais: "Explicacao",
        palavrasChave: "coração, aorta ,, coração",
        alternativas: { A: "A", B: "B", C: "C", D: "D", E: "E" },
      },
      "professor-1",
    );

    expect(transacao.questao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ palavrasChave: ["coração", "aorta"] }),
      }),
    );
  });

  test("criar aceita palavras-chave em array, removendo vazios e espacos", async () => {
    const tema = { id: "tema-1", nome: "Anatomia" };
    const transacao = {
      tema: { findFirst: jest.fn().mockResolvedValue(tema), create: jest.fn() },
      questao: { create: jest.fn().mockResolvedValue({ id: "questao-1" }) },
    };
    transactionMock.mockImplementation((callback) => callback(transacao));

    await repository.criar(
      {
        tema: "Anatomia",
        enunciado: "Enunciado",
        tipo: "MULTIPLA_ESCOLHA",
        dificuldade: "FACIL",
        imagem: "",
        alternativaCorreta: "A",
        saibaMais: "Explicacao",
        palavrasChave: [" veia ", "valva", ""],
        alternativas: { A: "A", B: "B", C: "C", D: "D", E: "E" },
      },
      "professor-1",
    );

    expect(transacao.questao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ palavrasChave: ["veia", "valva"] }),
      }),
    );
  });

  test("desativa questao usando soft delete", async () => {
    updateMock.mockResolvedValue({ id: "questao-1", status: "INATIVO" });

    const resposta = await repository.desativar("questao-1");

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "questao-1" },
      data: {
        status: "INATIVO",
        excluidoEm: expect.any(Date),
      },
      include: { tema: true, alternativas: true },
    });
    expect(resposta).toEqual({ id: "questao-1", status: "INATIVO" });
  });

  test("atualizar deve criar um NOVO tema se o tema passado não existir", async () => {
    const transacaoMock = {
      questao: {
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "nova-questao-id" }),
      },
      tema: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "tema-novo-id" }),
      },
    };

    transactionMock.mockImplementation((cb) => cb(transacaoMock));

    const dadosParaAtualizar = {
      tema: "Tema Inexistente",
      enunciado: "Novo enunciado",
      alternativas: {
        A: "Opção A",
        B: "Opção B",
        C: "Opção C",
        D: "Opção D",
        E: "Opção E",
      },
      tipo: "MULTIPLA_ESCOLHA" as const,
      dificuldade: "FACIL" as const,
      alternativaCorreta: "A" as const,
    };

    await repository.atualizar("id-velho", dadosParaAtualizar, "autor-1");

    expect(transacaoMock.tema.create).toHaveBeenCalledWith({
      data: { nome: "Tema Inexistente" },
    });

    expect(transacaoMock.questao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          temaId: "tema-novo-id",
        }),
      }),
    );
  });

  test("atualizar deve setar questaoOriginalId apontando para a questao substituida", async () => {
    const transacaoMock = {
      questao: {
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "nova-questao-id" }),
      },
      tema: {
        findFirst: jest.fn().mockResolvedValue({ id: "tema-existente-id" }),
        create: jest.fn(),
      },
    };

    transactionMock.mockImplementation((cb) => cb(transacaoMock));

    const dadosParaAtualizar = {
      tema: "Tema Existente",
      enunciado: "Novo enunciado",
      alternativas: {
        A: "Opção A",
        B: "Opção B",
        C: "Opção C",
        D: "Opção D",
        E: "Opção E",
      },
      tipo: "MULTIPLA_ESCOLHA" as const,
      dificuldade: "FACIL" as const,
      alternativaCorreta: "A" as const,
    };

    await repository.atualizar("id-velho", dadosParaAtualizar, "autor-1");

    expect(transacaoMock.questao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          questaoOriginalId: "id-velho",
        }),
      }),
    );
  });
});
