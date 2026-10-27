import * as Minio from "minio";

import { montarEndpointStorage } from "@/config/storage";

// Servico de upload de imagens das questoes no MinIO/S3.
export class MinioService {
  private minioClient: Minio.Client;
  private bucketName = "anatoquizup-imagens";

  constructor() {
    if (process.env.NODE_ENV === "production") {
      const publicUrl = process.env.MINIO_PUBLIC_URL;
      if (!publicUrl || !publicUrl.startsWith("https://")) {
        throw new Error("MINIO_PUBLIC_URL deve ser uma URL HTTPS publica em producao.");
      }
    }

    // O protocolo pertence ao endpoint do storage, nao ao ambiente da API.
    // No Railway, por exemplo, a API e publica via HTTPS e o MinIO usa HTTP privado.
    const endpoint = montarEndpointStorage(
      process.env.MINIO_ENDPOINT || "localhost",
      process.env.MINIO_API_PORT || "9000",
    );

    this.minioClient = new Minio.Client({
      endPoint: endpoint.hostname,
      port: endpoint.port,
      useSSL: endpoint.useSSL,
      accessKey: process.env.MINIO_ROOT_USER || "",
      secretKey: process.env.MINIO_ROOT_PASSWORD || "",
    });
  }

  // Envia a imagem ao bucket com nome unico e retorna sua URL publica.
  async uploadImagem(arquivo: Express.Multer.File): Promise<string> {
    // Prefixa com timestamp e troca espacos por "_" para evitar colisao/URL quebrada.
    const nomeOriginalLimpo = arquivo.originalname.replace(/\s/g, "_");
    const nomeArquivo = `${Date.now()}-${nomeOriginalLimpo}`;

    await this.minioClient.putObject(this.bucketName, nomeArquivo, arquivo.buffer, arquivo.size, {
      "Content-Type": arquivo.mimetype,
    });

    return this.gerarUrlPublica(nomeArquivo);
  }

  // Monta a URL publica do objeto conforme o ambiente/configuracao.
  private gerarUrlPublica(nomeArquivo: string): string {
    // URL publica explicita tem prioridade (ex.: CDN/dominio proprio).
    const publicUrl = process.env.MINIO_PUBLIC_URL;
    if (publicUrl) {
      const base = publicUrl.replace(/\/$/, "");
      return `${base}/${this.bucketName}/${encodeURIComponent(nomeArquivo)}`;
    }

    // Sem URL publica, o fallback so e valido para desenvolvimento local.
    const endpoint = montarEndpointStorage(
      process.env.MINIO_ENDPOINT || "localhost",
      process.env.MINIO_API_PORT || "9000",
    );
    return `${endpoint.s3Endpoint}/${this.bucketName}/${encodeURIComponent(nomeArquivo)}`;
  }
}
