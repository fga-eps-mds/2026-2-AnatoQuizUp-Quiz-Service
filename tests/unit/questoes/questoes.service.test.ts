import { QuestionService } from "../../../src/modules/questoes/questoes.service";
import type { QuestionRepository } from "../../../src/modules/questoes/questoes.repository";
import type { MinioService } from "../../../src/modules/questoes/minio.service";
import type {
  CriarQuestaoDto,
  RegistroQuestaoCompleta,
} from "../../../src/modules/questoes/dto/question.types";
import { MENSAGENS } from "@/shared/constants/mensagens";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";

function criarQuestao(overrides: Partial<RegistroQuestaoCompleta> = {}): RegistroQuestaoCompleta {
  const agora = new Date("2026-05-09T12:00:00.000Z");
  return {
    id: "questao-1",
    enunciado: "Qual estrutura bombeia sangue para a aorta?",
    tipoQuestao: "MULTIPLA_ESCOLHA",
    respostaCorreta: "B",
    dificuldade: "DIFICIL",
    saibaMais: "O ventriculo esquerdo impulsiona sangue.",
    status: "ATIVO",
    origemQuestao: "ELABORADA_POR_PROFESSOR",
    taxonomiaBloom: null,
    regiaoAnatomica: null,
    urlImagem: "https://cdn.example.com/coracao.png",
    criadoPorId: "professor-1",
    temaId: "tema-1",
    questaoOriginalId: null,
    criadoEm: agora,
    atualizadoEm: agora,
    excluidoEm: null,
    tema: {
      id: "tema-1",
      nome: "Sistema cardiovascular",
      criadoEm: agora,
      atualizadoEm: agora,
      excluidoEm: null,
    },
    alternativas: {
      id: "alternativas-1",
      alternativaA: "Atrio direito",
      alternativaB: "Ventriculo esquerdo",
      alternativaC: "Atrio esquerdo",
      alternativaD: "Ventriculo direito",
      alternativaE: "Veia cava",
      questaoId: "questao-1",
      criadoEm: agora,
      atualizadoEm: agora,
      excluidoEm: null,
    },
    ...overrides,
  };
}

function criarInputValido(): CriarQuestaoDto {
  return {
    tema: "Sistema cardiovascular",
    enunciado: "Enunciado teste",
    tipo: "MULTIPLA_ESCOLHA",
    alternativaCorreta: "B",
    saibaMais: "Explicacao",
    dificuldade: "DIFICIL",
    alternativas: {
      A: "A",
      B: "B",
      C: "C",
      D: "D",
      E: "E",
    },
    imagem: "",
  };
}

describe("QuestionService", () => {
  let repository: jest.Mocked<QuestionRepository>;
  let minioService: jest.Mocked<MinioService>;
  let service: QuestionService;

  const imagemMock = {
    originalname: "foto.jpg",
    buffer: Buffer.from("fake"),
    size: 1024,
    mimetype: "image/jpeg",
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();

    repository = {
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      criar: jest.fn(),
      atualizar: jest.fn(),
      desativar: jest.fn(),
      filtrar: jest.fn(),
    } as unknown as jest.Mocked<QuestionRepository>;

    minioService = {
      uploadImagem: jest.fn(),
    } as unknown as jest.Mocked<MinioService>;

    service = new QuestionService(repository, minioService);
  });

  describe("Leitura", () => {
    test("listar deve retornar dados paginados", async () => {
      repository.listar.mockResolvedValue({ data: [criarQuestao()], total: 1 });
      const result = await service.listar({ page: 1, limit: 10 });
      expect(result.dados).toHaveLength(1);
    });

    test("buscarPorId deve retornar questão", async () => {
      repository.buscarPorId.mockResolvedValue(criarQuestao());
      const result = await service.buscarPorId("1");
      expect(result.id).toBe("questao-1");
    });

    test("buscarPorId deve lançar 404", async () => {
      repository.buscarPorId.mockResolvedValue(null);
      await expect(service.buscarPorId("id-fake")).rejects.toMatchObject({ codigoStatus: 404 });
    });

    test("filtrar deve chamar repository com filtros", async () => {
      repository.filtrar.mockResolvedValue({ data: [], total: 0 });
      await service.filtrar({ tema: "Cardio" });
      expect(repository.filtrar).toHaveBeenCalled();
    });
  });

  describe("Criação e Validação", () => {
    test("criar deve fazer upload de imagem se enviada", async () => {
      const input = criarInputValido();
      minioService.uploadImagem.mockResolvedValue("url-minio");
      repository.criar.mockResolvedValue({
        questao: criarQuestao({ urlImagem: "url-minio" }),
        temaCriado: false,
      });

      const result = await service.criar(input, imagemMock, "prof-1");
      expect(minioService.uploadImagem).toHaveBeenCalled();
      expect(result.imagem).toBe("url-minio");
    });

    test("criar deve recusar imagem quando o armazenamento estiver desabilitado", async () => {
      const serviceSemArmazenamento = new QuestionService(repository);

      await expect(
        serviceSemArmazenamento.criar(criarInputValido(), imagemMock, "prof-1"),
      ).rejects.toMatchObject({
        codigoStatus: 503,
        codigo: CodigoDeErro.SERVICO_INDISPONIVEL,
        message: MENSAGENS.uploadImagemIndisponivel,
      });
      expect(minioService.uploadImagem).not.toHaveBeenCalled();
    });

    test("criar deve usar imagem do DTO se arquivo for nulo", async () => {
      const input = { ...criarInputValido(), imagem: "url-dto" };
      repository.criar.mockResolvedValue({
        questao: criarQuestao({ urlImagem: "url-dto" }),
        temaCriado: false,
      });
      const result = await service.criar(input, undefined, "prof-1");
      expect(result.imagem).toBe("url-dto");
    });

    test("deve lançar 401 se usuarioId for vazio", async () => {
      await expect(service.criar(criarInputValido(), undefined, "")).rejects.toMatchObject({
        codigoStatus: 401,
      });
    });

    test("validar falta de gabarito", async () => {
      const input = {
        ...criarInputValido(),
        alternativaCorreta: undefined,
      } as unknown as CriarQuestaoDto;
      await expect(service.criar(input, undefined, "p-1")).rejects.toThrow(
        MENSAGENS.questaoGabaritoObrigatorio,
      );
    });

    test("validar alternativas vazias", async () => {
      const input = { ...criarInputValido(), alternativas: {} } as unknown as CriarQuestaoDto;
      await expect(service.criar(input, undefined, "p-1")).rejects.toThrow(
        MENSAGENS.questaoAlternativasObrigatorias,
      );
    });

    test("validar falta de opções na Multipla Escolha", async () => {
      const input = criarInputValido();
      delete (input.alternativas as unknown as Record<string, string>).E;
      await expect(service.criar(input, undefined, "p-1")).rejects.toThrow(
        MENSAGENS.questaoAlternativasObrigatorias,
      );
    });

    test("validar falta de C ou E no Verdadeiro/Falso", async () => {
      const input = {
        ...criarInputValido(),
        tipo: "CERTO_ERRADO",
        alternativas: { C: "Certo" },
      } as unknown as CriarQuestaoDto;
      await expect(service.criar(input, undefined, "p-1")).rejects.toThrow(
        MENSAGENS.questaoAlternativasObrigatorias,
      );
    });

    test("validar gabarito incompatível com V/F", async () => {
      const input = {
        ...criarInputValido(),
        tipo: "CERTO_ERRADO",
        alternativas: { C: "C", E: "E" },
        alternativaCorreta: "A",
      } as unknown as CriarQuestaoDto;
      await expect(service.criar(input, undefined, "p-1")).rejects.toThrow(
        MENSAGENS.questaoGabaritoObrigatorio,
      );
    });
  });

  describe("Atualização e Remoção", () => {
    test("atualizar deve usar fallbacks dos dados antigos", async () => {
      const antiga = criarQuestao();
      repository.buscarPorId.mockResolvedValue(antiga);
      repository.atualizar.mockResolvedValue(antiga);
      await service.atualizar("1", {}, undefined, "u-1");
      expect(repository.atualizar).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ enunciado: antiga.enunciado }),
        "u-1",
      );
    });

    test("atualizar mantem os campos de classificacao da questao antiga quando nao enviados", async () => {
      const antiga = criarQuestao({
        taxonomiaBloom: "AVALIAR",
        origemQuestao: "LIVRO",
        regiaoAnatomica: "Abdome",
      });
      repository.buscarPorId.mockResolvedValue(antiga);
      repository.atualizar.mockResolvedValue(antiga);

      await service.atualizar("1", { enunciado: "Novo enunciado" }, undefined, "u-1");

      expect(repository.atualizar).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          taxonomiaBloom: "AVALIAR",
          origemQuestao: "LIVRO",
          regiaoAnatomica: "Abdome",
        }),
        "u-1",
      );
    });

    test("atualizar sobrescreve os campos de classificacao quando enviados", async () => {
      const antiga = criarQuestao({ taxonomiaBloom: "LEMBRAR", origemQuestao: "LIVRO" });
      repository.buscarPorId.mockResolvedValue(antiga);
      repository.atualizar.mockResolvedValue(antiga);

      await service.atualizar(
        "1",
        { taxonomiaBloom: "CRIAR", origemQuestao: "GERADA_POR_IA" },
        undefined,
        "u-1",
      );

      expect(repository.atualizar).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          taxonomiaBloom: "CRIAR",
          origemQuestao: "GERADA_POR_IA",
        }),
        "u-1",
      );
    });

    test("atualizar deve carregar nova imagem se enviada", async () => {
      repository.buscarPorId.mockResolvedValue(criarQuestao());
      minioService.uploadImagem.mockResolvedValue("nova-url");
      repository.atualizar.mockResolvedValue(criarQuestao({ urlImagem: "nova-url" }));
      await service.atualizar("1", {}, imagemMock, "u-1");
      expect(minioService.uploadImagem).toHaveBeenCalled();
    });

    test("remover deve lançar 404 se não encontrar", async () => {
      repository.buscarPorId.mockResolvedValue(null);
      await expect(service.remover("999")).rejects.toMatchObject({ codigoStatus: 404 });
    });

    test("remover deve desativar questão", async () => {
      repository.buscarPorId.mockResolvedValue(criarQuestao());
      repository.desativar.mockResolvedValue(criarQuestao({ status: "INATIVO" }));
      const result = await service.remover("1");
      expect(result.status).toBe("INATIVO");
    });
  });

  describe("Casos de Borda Alternativas", () => {
    test("extrairAlternativasAtuais deve tratar questao sem alternativas", async () => {
      const q = criarQuestao({
        alternativas: null as unknown as RegistroQuestaoCompleta["alternativas"],
      });
      repository.buscarPorId.mockResolvedValue(q);
      repository.atualizar.mockResolvedValue(q);
      await service.atualizar("1", {}, undefined, "u-1");
      expect(repository.atualizar).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ alternativas: {} }),
        "u-1",
      );
    });

    test("extrairAlternativasAtuais para CERTO_ERRADO", async () => {
      const q = criarQuestao({ tipoQuestao: "CERTO_ERRADO" });
      repository.buscarPorId.mockResolvedValue(q);
      repository.atualizar.mockResolvedValue(q);
      await service.atualizar("1", {}, undefined, "u-1");
      expect(repository.atualizar).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          alternativas: { C: q.alternativas?.alternativaC, E: q.alternativas?.alternativaE },
        }),
        "u-1",
      );
    });
  });
});
