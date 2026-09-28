import { S3Client } from "@aws-sdk/client-s3";
import * as Minio from "minio";

import { env } from "@/config/env";

// Configuracao de storage (MinIO/S3) para imagens das questoes.

// Clientes guardados no global para reuso entre hot-reloads (mesma logica do Prisma).
declare global {
  var __minio_native__: Minio.Client | undefined;
  var __s3_client__: S3Client | undefined;
}

// Normaliza endpoint+porta em hostname/porta/SSL e a URL S3 sem barra final.
export function montarEndpointStorage(endpoint: string, portaApi: string) {
  const porta = Number(portaApi);

  if (!Number.isInteger(porta) || porta <= 0) {
    throw new Error("Erro: MINIO_API_PORT invalida.");
  }

  // Garante um protocolo para o URL parser (assume http se nao houver).
  const endpointComProtocolo = /^https?:\/\//i.test(endpoint) ? endpoint : `http://${endpoint}`;
  const url = new URL(endpointComProtocolo);

  // Sobrescreve a porta e limpa partes irrelevantes do URL.
  url.port = String(porta);
  url.pathname = "";
  url.search = "";
  url.hash = "";

  return {
    hostname: url.hostname,
    port: porta,
    useSSL: url.protocol === "https:",
    s3Endpoint: url.toString().replace(/\/$/, ""),
  };
}

function criarClientesStorage() {
  const rawEndpoint = env.MINIO_ENDPOINT;
  const accessKey = env.MINIO_ROOT_USER;
  const secretKey = env.MINIO_ROOT_PASSWORD;
  const apiPort = env.MINIO_API_PORT;

  if (!rawEndpoint || !accessKey || !secretKey || !apiPort) {
    throw new Error("Erro: Variáveis do MinIO não configuradas.");
  }

  const minioEndpointConfig = montarEndpointStorage(rawEndpoint, apiPort);
  const minioAdmin =
    global.__minio_native__ ??
    new Minio.Client({
      endPoint: minioEndpointConfig.hostname,
      port: minioEndpointConfig.port,
      useSSL: minioEndpointConfig.useSSL,
      accessKey,
      secretKey,
    });

  const s3Client =
    global.__s3_client__ ??
    new S3Client({
      endpoint: minioEndpointConfig.s3Endpoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

  if (env.NODE_ENV !== "production") {
    global.__minio_native__ = minioAdmin;
    global.__s3_client__ = s3Client;
  }

  return { minioAdmin, s3Client };
}

// Garante a infraestrutura de storage no boot: cria o bucket publico se faltar.
export async function configurarStorage() {
  if (!env.STORAGE_ENABLED) {
    console.log("[Storage] Desabilitado neste ambiente.");
    return;
  }

  const bucketName = "anatoquizup-imagens";

  try {
    const { minioAdmin } = criarClientesStorage();
    const existe = await minioAdmin.bucketExists(bucketName);

    if (!existe) {
      console.log(`[Storage] Criando bucket "${bucketName}"...`);
      await minioAdmin.makeBucket(bucketName);

      // Politica que torna os objetos do bucket publicos para leitura (GET).
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Action: ["s3:GetObject"],
            Effect: "Allow",
            Principal: "*",
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };

      await minioAdmin.setBucketPolicy(bucketName, JSON.stringify(policy));
      console.log(`[Storage] Bucket "${bucketName}" configurado como público.`);
    } else {
      console.log(`[Storage] Infraestrutura pronta.`);
    }
  } catch (error) {
    console.error("[Storage] Erro detalhado:", error);
    throw new Error(`[Storage] Falha crítica: ${error}`);
  }
}
