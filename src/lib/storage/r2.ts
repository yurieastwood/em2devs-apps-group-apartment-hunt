import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cachedClient;
}

function getBucket(): string {
  return requiredEnv("R2_BUCKET");
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

// Returns a URL callers can use to fetch the object. If R2_PUBLIC_URL_BASE is
// set (bucket is public or bound to a custom domain), a direct URL is
// returned. Otherwise a short-lived presigned URL is generated.
export async function urlFor(
  key: string,
  presignTtlSeconds = 3600,
): Promise<string> {
  const base = process.env.R2_PUBLIC_URL_BASE;
  if (base) {
    return `${base.replace(/\/$/, "")}/${encodeURIComponent(key)}`;
  }
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: presignTtlSeconds },
  );
}
