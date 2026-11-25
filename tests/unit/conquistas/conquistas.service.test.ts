import { ConquistaService } from "@/modules/conquistas/conquistas.service";
import type { ConquistaRepository } from "@/modules/conquistas/conquistas.repository";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { MENSAGENS } from "@/shared/constants/mensagens";

function criarRepositoryMock() {
  return {
    existeConquistaTema: jest.fn(),
    criarConquistaTema: jest.fn(),
    buscarConquistaTema: jest.fn(),
    buscarConquistaTotalAcertos: jest.fn(),
    buscarConquistaStreak: jest.fn(),
    buscarOuCriarProgresso: jest.fn(),
    atualizarProgresso: jest.fn(),
    criarDesbloqueioComRecompensas: jest.fn(),

    buscarDesbloqueioPorId: jest.fn(),
    contarConquistasDestacadas: jest.fn(),
    alterarDestaque: jest.fn(),
    buscarConquistasDestacadas: jest.fn(),

    listarProgressoUsuario: jest.fn(),
    buscarProgressoConquistaUsuario: jest.fn(),
    listarDestaquesUsuarios: jest.fn(),
    listarMeuProgressoEmConquista: jest.fn(),
    listarDesbloqueadasUsuario: jest.fn(),
    listarConquistas: jest.fn(),
  } as unknown as jest.Mocked<ConquistaRepository>;
}

function criarConquista() {
  return {
    id: "conquista-id",
    nome: "Conquista",
    descricao: "Descricao",
    tipoConquista: "TOTAL_ACERTOS",
    temaId: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ativo: true,
  };
}

function criarDesbloqueio() {
  return {
    id: "desbloqueio-id",
    conquistaId: "conquista-id",
    usuarioId: "usuario-id",
    tier: "BRONZE",
    destaque: false,
    conquistadoEm: new Date(),
    conquista: {
      id: "conquista-id",
      nome: "Conquista",
      descricao: "Descricao",
      tipoConquista: "TOTAL_ACERTOS",
      tema: null,
    },
  };
}

function criarResumoConquistaDesbloqueada() {
  return {
    id: "desbloqueio-id",
    usuarioId: "usuario-id",
    conquistaId: "conquista-id",
    tier: "BRONZE",
    destaque: false,
    conquistadoEm: new Date(),
    conquista: {
      id: "conquista-id",
      nome: "Conquista",
      descricao: "Descricao",
      tipoConquista: "TOTAL_ACERTOS",
      temaId: null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      ativo: true,
    },
  };
}

function criarProgressoEmConquista() {
  return {
    id: "id",
    conquista: {
      id: "conquista-id",
      nome: "conquista-nome",
      descricao: "conquista-descricao",
      tipoConquista: "TOTAL_ACERTOS",
      desbloqueios: [
        {
          tier: "BRONZE",
          conquistadoEm: new Date(),
        },
      ],
    },
    valorProgresso: 10,
  };
}

function criarConquistaComProgresso() {
  return {
    id: "conquista-id",
    nome: "conquista-nome",
    descricao: "conquista-descricao",
    tipoConquista: "TOTAL_ACERTOS",
    tema: null,
    usuarios: [{ valorProgresso: 10 }],
    desbloqueios: [
      {
        id: "desbloqueio-id",
        tier: "BRONZE",
        destaque: false,
        conquistadoEm: new Date(),
      },
    ],
    recompensasItens: [],
  };
}

describe("ConquistaService", () => {
  let repository: jest.Mocked<ConquistaRepository>;
  let service: ConquistaService;

  beforeEach(() => {
    repository = criarRepositoryMock();
    service = new ConquistaService(repository);

    jest.clearAllMocks();
  });

  describe("criarConquistaPadraoTema", () => {
    test("não deve criar conquista se já existir", async () => {
      repository.existeConquistaTema.mockResolvedValue(true);

      await service.criarConquistaPadraoTema("tema-1", "Cardiologia");

      expect(repository.criarConquistaTema).not.toHaveBeenCalled();
    });

    test("deve criar conquista quando não existir", async () => {
      repository.existeConquistaTema.mockResolvedValue(false);
      repository.criarConquistaTema.mockResolvedValue(criarConquista());

      await service.criarConquistaPadraoTema("tema-1", "Cardiologia");

      expect(repository.criarConquistaTema).toHaveBeenCalledWith("tema-1", "Cardiologia");
    });

    test("deve lançar erro quando falhar ao criar", async () => {
      repository.existeConquistaTema.mockResolvedValue(false);
      repository.criarConquistaTema.mockResolvedValue(null);

      await expect(service.criarConquistaPadraoTema("tema-1", "Cardiologia")).rejects.toMatchObject(
        {
          codigo: CodigoDeErro.RECURSO_NAO_ENCONTRADO,
          message: "Não foi possível criar conquista",
        },
      );
    });
  });

  describe("alterarDestaque", () => {
    test("deve lançar erro quando usuário não informado", async () => {
      await expect(service.alterarDestaque(undefined, "id", true)).rejects.toMatchObject({
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        message: MENSAGENS.usuarioNaoEncontrado,
      });
    });

    test("deve lançar erro quando desbloqueio não existe", async () => {
      repository.buscarDesbloqueioPorId.mockResolvedValue(null);

      await expect(service.alterarDestaque("usuario-id", "id", true)).rejects.toMatchObject({
        codigo: CodigoDeErro.NAO_ENCONTRADO,
        message: MENSAGENS.conquistaNaoEncontrada,
      });
    });

    test("deve lançar erro quando já possui 3 destaques", async () => {
      repository.buscarDesbloqueioPorId.mockResolvedValue(criarDesbloqueio());
      repository.contarConquistasDestacadas.mockResolvedValue(3);

      await expect(service.alterarDestaque("usuario-id", "id", true)).rejects.toMatchObject({
        codigo: CodigoDeErro.CONFLITO,
        message: MENSAGENS.limiteConquistasDestacadas,
      });
    });

    test("deve alterar destaque com sucesso", async () => {
      repository.buscarDesbloqueioPorId.mockResolvedValue(criarDesbloqueio());
      repository.contarConquistasDestacadas.mockResolvedValue(1);
      repository.alterarDestaque.mockResolvedValue({ count: 1 });

      const resultado = await service.alterarDestaque("usuario-id", "id", true);

      expect(repository.alterarDestaque).toHaveBeenCalledWith("usuario-id", "id", true);

      expect(resultado).toEqual({
        sucesso: true,
      });
    });

    test("deve lançar erro ao falhar alterar destaques", async () => {
      repository.buscarDesbloqueioPorId.mockResolvedValue(criarDesbloqueio());
      repository.contarConquistasDestacadas.mockResolvedValue(1);
      repository.alterarDestaque.mockResolvedValue({ count: 0 });

      await expect(service.alterarDestaque("usuario-id", "id", true)).rejects.toMatchObject({
        codigo: CodigoDeErro.NAO_ENCONTRADO,
        message: MENSAGENS.conquistaNaoEncontrada,
      });
    });

    test("e idempotente quando o destaque ja esta no estado pedido", async () => {
      repository.buscarDesbloqueioPorId.mockResolvedValue({ ...criarDesbloqueio(), destaque: true });

      const resultado = await service.alterarDestaque("usuario-id", "id", true);

      expect(resultado).toEqual({ sucesso: true });
      expect(repository.contarConquistasDestacadas).not.toHaveBeenCalled();
      expect(repository.alterarDestaque).not.toHaveBeenCalled();
    });

    test("nao verifica o limite de destaques ao remover um destaque", async () => {
      repository.buscarDesbloqueioPorId.mockResolvedValue({ ...criarDesbloqueio(), destaque: true });
      repository.alterarDestaque.mockResolvedValue({ count: 1 });

      const resultado = await service.alterarDestaque("usuario-id", "id", false);

      expect(repository.contarConquistasDestacadas).not.toHaveBeenCalled();
      expect(repository.alterarDestaque).toHaveBeenCalledWith("usuario-id", "id", false);
      expect(resultado).toEqual({ sucesso: true });
    });
  });

  describe("buscarConquistasDestacadas", () => {
    test("deve lançar erro quando usuário não informado", async () => {
      await expect(service.buscarConquistasDestacadas(undefined)).rejects.toMatchObject({
        codigo: CodigoDeErro.NAO_AUTORIZADO,
      });
    });

    test("deve retornar conquistas destacadas", async () => {
      repository.buscarConquistasDestacadas.mockResolvedValue([criarDesbloqueio()]);

      const resultado = await service.buscarConquistasDestacadas("usuario-id");

      expect(resultado).toHaveLength(1);

      expect(resultado[0]).toMatchObject({
        desbloqueioId: "desbloqueio-id",
        conquistaId: "conquista-id",
        nome: "Conquista",
        tipoConquista: "TOTAL_ACERTOS",
        tema: null,
      });
    });
  });

  describe("listarConquistas", () => {
    test("deve listar conquistas paginadas", async () => {
      repository.listarConquistas.mockResolvedValue({
        data: [criarConquista()],
        total: 1,
      });

      const resultado = await service.listarConquistas({});

      expect(resultado.dados).toHaveLength(1);

      expect(resultado.metadados).toMatchObject({
        total: 1,
        page: 1,
        limit: 10,
      });
    });
  });

  describe("listarDesbloqueadasUsuario", () => {
    test("deve exigir usuário autenticado", async () => {
      await expect(service.listarDesbloqueadasUsuario({}, undefined)).rejects.toMatchObject({
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        message: MENSAGENS.usuarioNaoEncontrado,
      });
    });

    test("deve listar desbloqueios paginados", async () => {
      repository.listarDesbloqueadasUsuario.mockResolvedValue({
        data: [criarResumoConquistaDesbloqueada()],
        total: 1,
      });

      const resultado = await service.listarDesbloqueadasUsuario({}, "usuario-id");

      expect(resultado.dados).toHaveLength(1);

      expect(resultado.metadados).toMatchObject({
        total: 1,
        page: 1,
        limit: 10,
      });
    });
  });

  describe("listarMeuProgressoEmConquista", () => {
    test("deve exigir usuário autenticado", async () => {
      await expect(service.listarMeuProgressoEmConquista(undefined, "id")).rejects.toMatchObject({
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        message: MENSAGENS.usuarioNaoEncontrado,
      });
    });

    test("deve lançar erro caso busca do progresso em conquista falhe", async () => {
      repository.listarMeuProgressoEmConquista.mockResolvedValue(null);
      await expect(service.listarMeuProgressoEmConquista("usuario-id", "id")).rejects.toMatchObject(
        {
          codigo: CodigoDeErro.NAO_ENCONTRADO,
          message: MENSAGENS.conquistaNaoEncontrada,
        },
      );
    });

    test("deve listar progresso em conquista de usuario", async () => {
      const progressoEmConquista = criarProgressoEmConquista();
      repository.listarMeuProgressoEmConquista.mockResolvedValue(progressoEmConquista);

      const resultado = await service.listarMeuProgressoEmConquista("usuario-id", "id");

      expect(resultado).toMatchObject({
        id: progressoEmConquista.id,
        valor_progresso: progressoEmConquista.valorProgresso,
        nome: progressoEmConquista.conquista.nome,
        descricao: progressoEmConquista.conquista.descricao,
        tipoConquista: progressoEmConquista.conquista.tipoConquista,
        desbloqueios: progressoEmConquista.conquista.desbloqueios,
      });
    });
  });

  describe("listarProgressoUsuario", () => {
    test("deve exigir usuário autenticado", async () => {
      await expect(service.listarProgressoUsuario({}, undefined)).rejects.toMatchObject({
        codigo: CodigoDeErro.NAO_AUTORIZADO,
      });
    });

    test("deve propagar erro caso busca do progresso falhe", async () => {
      const erro = new Error("falha ao consultar progresso");
      repository.listarProgressoUsuario.mockRejectedValue(erro);

      await expect(service.listarProgressoUsuario({}, "usuario-id")).rejects.toBe(erro);
    });

    test("deve listar progresso de usuario paginado", async () => {
      repository.listarProgressoUsuario.mockResolvedValue({
        data: [criarConquistaComProgresso()],
        total: 1,
      });

      const resultado = await service.listarProgressoUsuario({}, "usuario-id");

      expect(resultado.dados).toHaveLength(1);
      expect(resultado.dados[0]).toMatchObject({
        id: "conquista-id",
        valorProgresso: 10,
        proximoTier: "PRATA",
        proximoObjetivo: 50,
        percentual: 20,
      });

      expect(resultado.metadados).toMatchObject({
        total: 1,
        page: 1,
        limit: 10,
      });
    });
  });

  describe("processarRespostaQuestao", () => {
    test("deve processar total de acertos quando a resposta for correta", async () => {
      const spyTotalAcertos = jest.spyOn(service, "processarTotalAcertos").mockResolvedValue([]);
      const spyTotalAcertosTema = jest
        .spyOn(service, "processarTotalAcertosTema")
        .mockResolvedValue([]);
      const spyProcessarStreak = jest.spyOn(service, "processarStreak").mockResolvedValue([]);

      const usuarioId = "usuario-id";
      const temaId = "tema-id";
      const temaNome = "tema-nome";
      const correta = true;

      await service.processarRespostaQuestao(usuarioId, temaId, temaNome, correta);

      expect(spyTotalAcertos).toHaveBeenCalledWith(usuarioId);
      expect(spyTotalAcertosTema).toHaveBeenCalledWith(usuarioId, temaId, temaNome);
      expect(spyProcessarStreak).toHaveBeenCalledWith(usuarioId, correta);
    });

    test("nao deve processar total de acertos quando a resposta for correta", async () => {
      const spyTotalAcertos = jest.spyOn(service, "processarTotalAcertos").mockResolvedValue([]);
      const spyTotalAcertosTema = jest
        .spyOn(service, "processarTotalAcertosTema")
        .mockResolvedValue([]);
      const spyProcessarStreak = jest.spyOn(service, "processarStreak").mockResolvedValue([]);

      const usuarioId = "usuario-id";
      const temaId = "tema-id";
      const temaNome = "tema-nome";
      const correta = false;

      await service.processarRespostaQuestao(usuarioId, temaId, temaNome, correta);

      expect(spyTotalAcertos).not.toHaveBeenCalled();
      expect(spyTotalAcertosTema).not.toHaveBeenCalled();
      expect(spyProcessarStreak).toHaveBeenCalledWith(usuarioId, correta);
    });

    test("deve retornar um array vazio caso nenhuma conquista seja desbloqueada", async () => {
      repository.buscarConquistaTotalAcertos.mockResolvedValue(null);
      repository.buscarConquistaTema.mockResolvedValue(null);
      repository.buscarConquistaStreak.mockResolvedValue(null);

      const usuarioId = "usuario-id";
      const temaId = "tema-id";
      const temaNome = "tema-nome";
      const correta = false;

      const resultado = await service.processarRespostaQuestao(
        usuarioId,
        temaId,
        temaNome,
        correta,
      );

      expect(resultado).toStrictEqual([]);
    });

    test("deve lançar erro caso não seja possível buscar/criar progresso", async () => {
      repository.buscarConquistaTotalAcertos.mockResolvedValue(criarConquista());
      repository.buscarOuCriarProgresso.mockResolvedValue(null);

      await expect(
        service.processarRespostaQuestao("usuario-id", "tema-id", "tema-nome", true),
      ).rejects.toMatchObject({
        codigo: CodigoDeErro.RECURSO_NAO_ENCONTRADO,
        message: "Não foi possível registrar progresso em conquista",
      });
    });

    test("deve incrementar progresso em total de acertos", async () => {
      const conquista = criarConquista();

      repository.buscarConquistaTotalAcertos.mockResolvedValue(conquista);

      repository.buscarOuCriarProgresso.mockResolvedValue({ valorProgresso: 10 });

      const spy = jest.spyOn(service, "atualizarConquista").mockResolvedValue([]);

      await service.processarTotalAcertos("user-1");

      expect(spy).toHaveBeenCalledWith("user-1", conquista, 11);
    });

    test("deve retornar lista vazia quando conquista de total de acertos não existir", async () => {
      repository.buscarConquistaTotalAcertos.mockResolvedValue(null);

      const resultado = await service.processarTotalAcertos("usuario-1");

      expect(resultado).toEqual([]);

      expect(repository.buscarOuCriarProgresso).not.toHaveBeenCalled();
    });

    test("deve retornar lista vazia quando conquista de tema não existir", async () => {
      jest.spyOn(service, "criarConquistaPadraoTema").mockResolvedValue(undefined);

      repository.buscarConquistaTema.mockResolvedValue(null);

      const resultado = await service.processarTotalAcertosTema(
        "usuario-1",
        "tema-1",
        "Matemática",
      );

      expect(resultado).toEqual([]);

      expect(repository.buscarOuCriarProgresso).not.toHaveBeenCalled();
    });

    test("deve incrementar progresso em total de acertos do tema", async () => {
      jest.spyOn(service, "criarConquistaPadraoTema").mockResolvedValue(undefined);

      const conquista = criarConquista();
      repository.buscarConquistaTema.mockResolvedValue(conquista);
      repository.buscarOuCriarProgresso.mockResolvedValue({ valorProgresso: 3 });

      const spy = jest.spyOn(service, "atualizarConquista").mockResolvedValue([]);

      await service.processarTotalAcertosTema("usuario-1", "tema-1", "Matemática");

      expect(spy).toHaveBeenCalledWith("usuario-1", conquista, 4);
    });

    test("deve lançar erro quando não conseguir registrar progresso da conquista por tema", async () => {
      jest.spyOn(service, "criarConquistaPadraoTema").mockResolvedValue(undefined);

      repository.buscarConquistaTema.mockResolvedValue(criarConquista());

      repository.buscarOuCriarProgresso.mockResolvedValue(null);

      await expect(
        service.processarTotalAcertosTema("usuario-1", "tema-1", "Matemática"),
      ).rejects.toMatchObject({
        codigo: CodigoDeErro.RECURSO_NAO_ENCONTRADO,
        message: "Não foi possível registrar progresso em conquista",
      });
    });

    test("deve incrementar streak quando resposta for correta", async () => {
      const conquista = criarConquista();

      repository.buscarConquistaStreak.mockResolvedValue(conquista);

      repository.buscarOuCriarProgresso.mockResolvedValue({ valorProgresso: 5 });

      const spy = jest.spyOn(service, "atualizarConquista").mockResolvedValue([]);

      await service.processarStreak("user-1", true);

      expect(spy).toHaveBeenCalledWith("user-1", conquista, 6);
    });

    test("deve resetar streak quando resposta for incorreta", async () => {
      const conquista = criarConquista();

      repository.buscarConquistaStreak.mockResolvedValue(conquista);

      repository.buscarOuCriarProgresso.mockResolvedValue({ valorProgresso: 5 });

      const spy = jest.spyOn(service, "atualizarConquista").mockResolvedValue([]);

      await service.processarStreak("user-1", false);

      expect(spy).toHaveBeenCalledWith("user-1", conquista, 0);
    });

    test("deve lançar erro quando não conseguir registrar progresso do streak", async () => {
      repository.buscarConquistaStreak.mockResolvedValue(criarConquista());
      repository.buscarOuCriarProgresso.mockResolvedValue(null);

      await expect(service.processarStreak("user-1", true)).rejects.toMatchObject({
        codigo: CodigoDeErro.RECURSO_NAO_ENCONTRADO,
        message: "Não foi possível registrar progresso em conquista",
      });
    });

    describe("atualizarConquista", () => {
      const usuarioId = "usuario-1";

      const conquista = {
        id: "conquista-1",
        nome: "Primeiros Passos",
        descricao: "Descrição",
        tipoConquista: "TOTAL_ACERTOS",
        temaId: "tema-1",
      };
      test("deve lançar erro quando não conseguir atualizar progresso", async () => {
        repository.atualizarProgresso.mockResolvedValue(null);

        await expect(service.atualizarConquista(usuarioId, conquista, 10)).rejects.toMatchObject({
          codigo: CodigoDeErro.RECURSO_NAO_ENCONTRADO,
          message: "Não foi possível atualizar progresso em conquista",
        });
      });

      test("deve retornar lista vazia quando não houver tiers configurados", async () => {
        repository.atualizarProgresso.mockResolvedValue({
          valorProgresso: 10,
        });

        const conquistaSemTier = {
          ...conquista,
          tipoConquista: "TIPO_INEXISTENTE",
        } as Conquista;

        const resultado = await service.atualizarConquista(usuarioId, conquistaSemTier, 10);

        expect(resultado).toEqual([]);
      });

      test("não deve desbloquear tier quando progresso for menor que o objetivo", async () => {
        repository.atualizarProgresso.mockResolvedValue({
          valorProgresso: 0,
        });

        const resultado = await service.atualizarConquista(usuarioId, conquista, 0);

        expect(resultado).toEqual([]);
        expect(repository.criarDesbloqueioComRecompensas).not.toHaveBeenCalled();
      });

      test("não deve duplicar desbloqueio quando a transacao atomica retornar null", async () => {
        repository.atualizarProgresso.mockResolvedValue({
          valorProgresso: 100,
        });

        repository.criarDesbloqueioComRecompensas.mockResolvedValue(null);

        const resultado = await service.atualizarConquista(usuarioId, conquista, 100);

        expect(resultado).toEqual([]);
      });

      test("deve desbloquear um tier", async () => {
        repository.atualizarProgresso.mockResolvedValue({
          valorProgresso: 10,
        });

        repository.criarDesbloqueioComRecompensas.mockResolvedValue({
          desbloqueio: { id: "desbloqueio-1" },
          moedasConcedidas: 30,
          saldoMoedas: 30,
          itemConcedido: null,
        });

        const resultado = await service.atualizarConquista(usuarioId, conquista, 100);

        expect(resultado).toHaveLength(1);

        expect(resultado[0]).toMatchObject({
          conquistaId: conquista.id,
          desbloqueioId: "desbloqueio-1",
          nome: conquista.nome,
          descricao: conquista.descricao,
          tipoConquista: conquista.tipoConquista,
          temaId: conquista.temaId,
          moedasConcedidas: 30,
          saldoMoedas: 30,
          itemConcedido: null,
        });
      });

      test("deve incluir o item exclusivo concedido junto ao desbloqueio", async () => {
        repository.atualizarProgresso.mockResolvedValue({
          valorProgresso: 10,
        });

        repository.criarDesbloqueioComRecompensas.mockResolvedValue({
          desbloqueio: { id: "desbloqueio-1" },
          moedasConcedidas: 30,
          saldoMoedas: 30,
          itemConcedido: {
            id: "item-1",
            codigo: "cod-1",
            nome: "Item",
            descricao: "Descricao do item",
            tipo: "COSMETICO",
            valor: null,
            imagemUrl: "https://exemplo.com/img.png",
            previewImagemUrl: null,
          },
        });

        const resultado = await service.atualizarConquista(usuarioId, conquista, 100);

        expect(resultado[0].itemConcedido).toMatchObject({
          id: "item-1",
          codigo: "cod-1",
          nome: "Item",
        });
      });

      test("deve desbloquear múltiplos tiers atingidos pelo progresso", async () => {
        repository.atualizarProgresso.mockResolvedValue({
          valorProgresso: 1000,
        });

        let contador = 0;

        repository.criarDesbloqueioComRecompensas.mockImplementation(async () => ({
          desbloqueio: { id: `desbloqueio-${++contador}` },
          moedasConcedidas: 30,
          saldoMoedas: contador * 30,
          itemConcedido: null,
        }));

        const resultado = await service.atualizarConquista(usuarioId, conquista, 1000);

        expect(resultado.length).toBeGreaterThan(1);

        expect(repository.criarDesbloqueioComRecompensas).toHaveBeenCalledTimes(
          resultado.length,
        );
      });
    });
  });

  describe("buscarDetalheConquista", () => {
    test("deve exigir usuário autenticado", async () => {
      await expect(service.buscarDetalheConquista(undefined, "conquista-id")).rejects.toMatchObject({
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        message: MENSAGENS.usuarioNaoEncontrado,
      });
    });

    test("deve lançar erro quando a conquista não é encontrada", async () => {
      repository.buscarProgressoConquistaUsuario.mockResolvedValue(null);

      await expect(
        service.buscarDetalheConquista("usuario-id", "conquista-id"),
      ).rejects.toMatchObject({
        codigo: CodigoDeErro.NAO_ENCONTRADO,
        message: MENSAGENS.conquistaNaoEncontrada,
      });
    });

    test("deve retornar o detalhe consolidado da conquista", async () => {
      repository.buscarProgressoConquistaUsuario.mockResolvedValue(criarConquistaComProgresso());

      const resultado = await service.buscarDetalheConquista("usuario-id", "conquista-id");

      expect(resultado).toMatchObject({
        id: "conquista-id",
        valorProgresso: 10,
        proximoTier: "PRATA",
      });
    });
  });

  describe("listarDestaquesUsuarios", () => {
    test("devolve uma lista vazia para usuarios sem destaques e preenche quem tem", async () => {
      const destaque = {
        id: "desbloqueio-1",
        usuarioId: "usuario-1",
        tier: "BRONZE",
        conquistadoEm: new Date(),
        conquista: {
          id: "conquista-1",
          nome: "Conquista",
          descricao: "Descricao",
          tipoConquista: "TOTAL_ACERTOS",
          tema: null,
        },
      };
      repository.listarDestaquesUsuarios.mockResolvedValue([destaque]);

      const resultado = await service.listarDestaquesUsuarios(["usuario-1", "usuario-2"]);

      expect(resultado["usuario-2"]).toEqual([]);
      expect(resultado["usuario-1"]).toHaveLength(1);
      expect(resultado["usuario-1"][0]).toMatchObject({
        desbloqueioId: "desbloqueio-1",
        conquistaId: "conquista-1",
        nome: "Conquista",
      });
    });
  });

  describe("converterProgressoConsolidado (via listarProgressoUsuario)", () => {
    test("usa zero como progresso quando o usuario ainda nao tem registro", async () => {
      repository.listarProgressoUsuario.mockResolvedValue({
        data: [{ ...criarConquistaComProgresso(), usuarios: [] }],
        total: 1,
      });

      const resultado = await service.listarProgressoUsuario({}, "usuario-id");

      expect(resultado.dados[0].valorProgresso).toBe(0);
    });

    test("nao monta tiers quando o tipo de conquista nao tem configuracao", async () => {
      repository.listarProgressoUsuario.mockResolvedValue({
        data: [{ ...criarConquistaComProgresso(), tipoConquista: "TIPO_SEM_CONFIG" }],
        total: 1,
      });

      const resultado = await service.listarProgressoUsuario({}, "usuario-id");

      expect(resultado.dados[0]).toMatchObject({
        tiers: [],
        proximoTier: null,
        proximoObjetivo: null,
        percentual: 0,
      });
    });

    test("marca 100% e nenhum proximo tier quando tudo ja foi desbloqueado", async () => {
      repository.listarProgressoUsuario.mockResolvedValue({
        data: [
          {
            ...criarConquistaComProgresso(),
            usuarios: [{ valorProgresso: 200 }],
            desbloqueios: [
              { id: "d-bronze", tier: "BRONZE", destaque: false, conquistadoEm: new Date() },
              { id: "d-prata", tier: "PRATA", destaque: false, conquistadoEm: new Date() },
              { id: "d-ouro", tier: "OURO", destaque: false, conquistadoEm: new Date() },
            ],
          },
        ],
        total: 1,
      });

      const resultado = await service.listarProgressoUsuario({}, "usuario-id");

      expect(resultado.dados[0]).toMatchObject({
        proximoTier: null,
        proximoObjetivo: null,
        percentual: 100,
      });
    });
  });
});
