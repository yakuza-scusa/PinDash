import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { database, MediaStatus } from "@pindash/database";
import type { CreateUploadIntent } from "@pindash/contracts";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { extname } from "node:path";
import sharp from "sharp";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function detectMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes
      .slice(0, 8)
      .every(
        (value, index) =>
          value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index],
      )
  )
    return "image/png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

export function containsMalwareSignature(bytes: Uint8Array): boolean {
  const sample = Buffer.from(bytes).toString("utf8");
  return sample.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");
}

@Injectable()
export class MediaService {
  private readonly bucket = process.env.S3_BUCKET ?? "pindash-media";
  private readonly s3 = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "pindash",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });

  private async requireWorkspace(userId: string, workspaceId: string) {
    const member = await database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException("Workspace access denied");
  }

  async list(userId: string) {
    const assets = await database.mediaAsset.findMany({
      where: { workspace: { members: { some: { userId } } }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        workspaceId: true,
        originalFilename: true,
        mimeType: true,
        byteSize: true,
        width: true,
        height: true,
        status: true,
        malwareScanStatus: true,
        createdAt: true,
      },
    });
    return assets.map((asset) => ({
      ...asset,
      byteSize: asset.byteSize.toString(),
    }));
  }

  async createUploadIntent(userId: string, input: CreateUploadIntent) {
    await this.requireWorkspace(userId, input.workspaceId);
    const extension = extname(input.filename)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, "")
      .slice(0, 8);
    const storageKey = `${input.workspaceId}/${randomUUID()}${extension}`;
    const asset = await database.mediaAsset.create({
      data: {
        workspaceId: input.workspaceId,
        uploadedByUserId: userId,
        storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        byteSize: BigInt(input.byteSize),
        sha256: "pending",
        status: MediaStatus.UPLOADING,
      },
      select: { id: true },
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: input.mimeType,
        ContentLength: input.byteSize,
      }),
      { expiresIn: 300 },
    );
    return { assetId: asset.id, uploadUrl, expiresInSeconds: 300 };
  }

  private retrievalSignature(assetId: string, expires: number): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret)
      throw new ServiceUnavailableException("SESSION_SECRET is missing");
    return createHmac("sha256", secret)
      .update(`pinterest-media:${assetId}:${expires}`)
      .digest("hex");
  }

  async createRetrievalUrl(storageKey: string): Promise<string> {
    const publicApiUrl = process.env.PUBLIC_API_URL?.replace(/\/$/, "");
    if (!publicApiUrl || !publicApiUrl.startsWith("https://"))
      throw new ServiceUnavailableException(
        "PUBLIC_API_URL must be a public HTTPS address before publishing",
      );
    const asset = await database.mediaAsset.findFirst({
      where: { storageKey, status: MediaStatus.READY, deletedAt: null },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException("Approved media is unavailable");
    const expires = Math.floor(Date.now() / 1000) + 10 * 60;
    const signature = this.retrievalSignature(asset.id, expires);
    return `${publicApiUrl}/api/v1/media/retrieve/${encodeURIComponent(asset.id)}?expires=${expires}&signature=${signature}`;
  }

  async retrieveForPinterest(
    assetId: string,
    expiresInput: string,
    signature: string,
  ) {
    const expires = Number(expiresInput);
    const now = Math.floor(Date.now() / 1000);
    if (
      !Number.isSafeInteger(expires) ||
      expires <= now ||
      expires > now + 15 * 60
    )
      throw new ForbiddenException("Media link is invalid or expired");
    const expected = this.retrievalSignature(assetId, expires);
    const valid =
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid)
      throw new ForbiddenException("Media link is invalid or expired");
    const asset = await database.mediaAsset.findFirst({
      where: { id: assetId, status: MediaStatus.READY, deletedAt: null },
      select: { storageKey: true, mimeType: true },
    });
    if (!asset) throw new NotFoundException("Media is unavailable");
    const object = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: asset.storageKey }),
    );
    if (!object.Body) throw new NotFoundException("Media is unavailable");
    return { body: object.Body, mimeType: asset.mimeType };
  }

  async completeUpload(userId: string, id: string) {
    const asset = await database.mediaAsset.findFirst({
      where: {
        id,
        workspace: { members: { some: { userId } } },
        deletedAt: null,
      },
    });
    if (!asset) throw new NotFoundException("Media asset not found");
    if (asset.status !== MediaStatus.UPLOADING)
      throw new BadRequestException("Upload is not awaiting completion");
    await database.mediaAsset.update({
      where: { id },
      data: { status: MediaStatus.PROCESSING, malwareScanStatus: "PENDING" },
    });
    try {
      const object = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: asset.storageKey }),
      );
      const bytes = new Uint8Array(await object.Body!.transformToByteArray());
      if (bytes.byteLength > MAX_BYTES)
        throw new BadRequestException("File exceeds 10 MB");
      if (containsMalwareSignature(bytes)) {
        await database.mediaAsset.update({
          where: { id },
          data: { status: MediaStatus.REJECTED, malwareScanStatus: "INFECTED" },
        });
        throw new BadRequestException("File failed malware scanning");
      }
      const detectedMime = detectMime(bytes);
      if (
        !detectedMime ||
        !ALLOWED.has(detectedMime) ||
        detectedMime !== asset.mimeType
      )
        throw new BadRequestException(
          "File signature does not match the declared image type",
        );
      const image = sharp(bytes, {
        failOn: "error",
        limitInputPixels: 100_000_000,
      }).rotate();
      const metadata = await image.metadata();
      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width < 200 ||
        metadata.height < 200 ||
        metadata.width > 10_000 ||
        metadata.height > 10_000
      )
        throw new BadRequestException(
          "Image dimensions must be between 200 and 10,000 pixels",
        );
      const sanitized =
        detectedMime === "image/jpeg"
          ? await image.jpeg({ quality: 92 }).toBuffer()
          : detectedMime === "image/png"
            ? await image.png().toBuffer()
            : await image.webp({ quality: 92 }).toBuffer();
      const thumbnail = await sharp(sanitized)
        .resize({
          width: 320,
          height: 320,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
      const thumbnailStorageKey = `${asset.storageKey}.thumb.webp`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: asset.storageKey,
          Body: sanitized,
          ContentType: detectedMime,
        }),
      );
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: thumbnailStorageKey,
          Body: thumbnail,
          ContentType: "image/webp",
        }),
      );
      const updated = await database.mediaAsset.update({
        where: { id },
        data: {
          mimeType: detectedMime,
          byteSize: BigInt(sanitized.byteLength),
          width: metadata.width,
          height: metadata.height,
          sha256: createHash("sha256").update(sanitized).digest("hex"),
          status: MediaStatus.READY,
          malwareScanStatus: "CLEAN",
          thumbnailStorageKey,
        },
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          byteSize: true,
          width: true,
          height: true,
          status: true,
        },
      });
      return { ...updated, byteSize: updated.byteSize.toString() };
    } catch (error) {
      await database.mediaAsset.update({
        where: { id },
        data: {
          status: MediaStatus.REJECTED,
          ...(error instanceof BadRequestException
            ? {}
            : { malwareScanStatus: "ERROR" as const }),
        },
      });
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("Uploaded object could not be verified");
    }
  }

  async preview(userId: string, id: string) {
    const asset = await database.mediaAsset.findFirst({
      where: {
        id,
        workspace: { members: { some: { userId } } },
        deletedAt: null,
      },
      select: { thumbnailStorageKey: true, storageKey: true },
    });
    if (!asset) throw new NotFoundException("Media asset not found");
    const key = asset.thumbnailStorageKey ?? asset.storageKey;
    const object = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!object.Body) throw new NotFoundException("Preview is unavailable");
    return {
      body: object.Body,
      mimeType: asset.thumbnailStorageKey
        ? "image/webp"
        : "application/octet-stream",
    };
  }

  async remove(userId: string, id: string) {
    const asset = await database.mediaAsset.findFirst({
      where: {
        id,
        workspace: { members: { some: { userId } } },
        deletedAt: null,
      },
      select: { id: true, storageKey: true, thumbnailStorageKey: true },
    });
    if (!asset) throw new NotFoundException("Media asset not found");
    const inUse = await database.pinDraft.count({
      where: { mediaAssetId: id, status: { notIn: ["CANCELLED", "FAILED"] } },
    });
    if (inUse) throw new BadRequestException("Media is used by an active Pin");
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: asset.storageKey }),
    );
    if (asset.thumbnailStorageKey)
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: asset.thumbnailStorageKey,
        }),
      );
    await database.mediaAsset.update({
      where: { id },
      data: { status: MediaStatus.DELETED, deletedAt: new Date() },
    });
    return { deleted: true };
  }
}
