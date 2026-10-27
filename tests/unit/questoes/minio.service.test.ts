import { MinioService } from "../../../src/modules/questoes/minio.service";
import * as Minio from "minio";

jest.mock("minio");

describe("MinioService", () => {
  let service: MinioService;
  let mockMinioClient: {
    putObject: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.MINIO_ENDPOINT = "http://localhost";
    process.env.MINIO_API_PORT = "9000";
    process.env.NODE_ENV = "development";
    process.env.MINIO_ROOT_USER = "user";
    process.env.MINIO_ROOT_PASSWORD = "password";

    mockMinioClient = {
      putObject: jest.fn().mockResolvedValue(null),
    };

    (Minio.Client as unknown as jest.Mock).mockImplementation(() => mockMinioClient);

    service = new MinioService();
  });

  it("deve ser instanciado corretamente", () => {
    expect(service).toBeDefined();
    expect(Minio.Client).toHaveBeenCalled();
  });

  describe("uploadImagem", () => {
    it("deve formatar o nome do arquivo e chamar o putObject com os parâmetros corretos", async () => {
      const mockDate = 123456789;
      jest.spyOn(Date, "now").mockReturnValue(mockDate);

      const mockFile = {
        originalname: "teste imagem.png",
        buffer: Buffer.from("conteudo-fake"),
        size: 1024,
        mimetype: "image/png",
      } as unknown as Express.Multer.File;

      const nomeEsperado = `${mockDate}-teste_imagem.png`;
      const urlEsperada = "http://localhost:9000/anatoquizup-imagens/" + nomeEsperado;

      const resultado = await service.uploadImagem(mockFile);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        "anatoquizup-imagens",
        nomeEsperado,
        mockFile.buffer,
        mockFile.size,
        { "Content-Type": "image/png" },
      );

      expect(resultado).toBe(urlEsperada);
    });
  });

  describe("gerarUrlPublica", () => {
    it("usa o endpoint interno para upload e a URL HTTPS publica para leitura", async () => {
      process.env.NODE_ENV = "production";
      process.env.MINIO_ENDPOINT = "http://minio.railway.internal:9001";
      process.env.MINIO_API_PORT = "9000";
      process.env.MINIO_PUBLIC_URL = "https://assets.example.com";
      service = new MinioService();

      expect(Minio.Client).toHaveBeenLastCalledWith({
        endPoint: "minio.railway.internal",
        port: 9000,
        useSSL: false,
        accessKey: "user",
        secretKey: "password",
      });

      const mockFile = {
        originalname: "foto.jpg",
        buffer: Buffer.from(""),
        size: 0,
        mimetype: "image/jpeg",
      } as unknown as Express.Multer.File;

      const resultado = await service.uploadImagem(mockFile);

      expect(resultado).toContain("https://assets.example.com/anatoquizup-imagens/");
      expect(resultado).not.toContain("railway.internal");
    });

    it("recusa iniciar em producao sem URL publica HTTPS", () => {
      process.env.NODE_ENV = "production";
      delete process.env.MINIO_PUBLIC_URL;

      expect(() => new MinioService()).toThrow("MINIO_PUBLIC_URL deve ser uma URL HTTPS publica em producao.");
    });
  });
});
