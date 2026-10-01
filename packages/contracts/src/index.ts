import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const PinStatusSchema = z.enum([
  "draft",
  "awaiting_approval",
  "approved",
  "scheduled",
  "queued",
  "publishing",
  "published",
  "failed",
  "cancelled",
  "connection_required",
  "unknown_result",
]);

export type PinStatus = z.infer<typeof PinStatusSchema>;

const OptionalUuidSchema = z.string().uuid().nullish();

export const SavePinDraftSchema = z.object({
  workspaceId: z.string().uuid(),
  connectionId: OptionalUuidSchema,
  mediaAssetId: OptionalUuidSchema,
  boardId: z.string().min(1).max(100).nullish(),
  title: z.string().max(100).default(""),
  description: z.string().max(800).default(""),
  altText: z.string().max(500).nullish(),
  destinationUrl: z
    .url()
    .refine(
      (value) => ["http:", "https:"].includes(new URL(value).protocol),
      "Only HTTP and HTTPS URLs are allowed",
    )
    .nullish(),
  scheduledForUtc: z.iso.datetime().nullish(),
  scheduleTimezone: z.string().max(100).nullish(),
});

export const UpdatePinDraftSchema = SavePinDraftSchema.omit({
  workspaceId: true,
}).partial();
export type SavePinDraft = z.infer<typeof SavePinDraftSchema>;
export type UpdatePinDraft = z.infer<typeof UpdatePinDraftSchema>;

export const PinterestBoardSchema = z.object({
  id: z.string(),
  name: z.string(),
  privacy: z.string().optional(),
});
export type PinterestBoard = z.infer<typeof PinterestBoardSchema>;

export const MediaMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const CreateUploadIntentSchema = z.object({
  workspaceId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mimeType: MediaMimeTypeSchema,
  byteSize: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});
export type CreateUploadIntent = z.infer<typeof CreateUploadIntentSchema>;

export const ApprovePinSchema = z.object({
  confirmed: z.literal(true),
  draftVersion: z.number().int().positive(),
});
export type ApprovePin = z.infer<typeof ApprovePinSchema>;
