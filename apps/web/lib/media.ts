import { API_URL } from "./pin-data";

export interface MediaAsset {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: string;
  width: number | null;
  height: number | null;
  status: string;
  createdAt?: string;
}

async function responseMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (Array.isArray(payload?.message)) return payload.message.join(" ");
  return payload?.message ?? fallback;
}

export async function uploadMedia(
  file: File,
  workspaceId: string,
): Promise<MediaAsset> {
  if (
    !file.type ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("The image must be smaller than 10 MB.");

  const intentResponse = await fetch(`${API_URL}/media/upload-intents`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      filename: file.name,
      mimeType: file.type,
      byteSize: file.size,
    }),
  });
  if (!intentResponse.ok)
    throw new Error(
      await responseMessage(
        intentResponse,
        "Could not prepare secure storage.",
      ),
    );
  const intent = (await intentResponse.json()) as {
    assetId: string;
    uploadUrl: string;
  };
  if (
    window.location.protocol === "https:" &&
    !intent.uploadUrl.startsWith("https://")
  )
    throw new Error(
      "Media storage returned an insecure URL. Update the production S3 endpoint.",
    );

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(intent.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new Error(
      "Could not reach media storage. Check its public HTTPS endpoint and CORS policy.",
    );
  }
  if (!uploadResponse.ok)
    throw new Error(
      `Storage rejected the image (${uploadResponse.status}). Check the bucket credentials and CORS policy.`,
    );

  const completeResponse = await fetch(
    `${API_URL}/media/${intent.assetId}/complete`,
    { method: "POST", credentials: "include" },
  );
  if (!completeResponse.ok)
    throw new Error(
      await responseMessage(
        completeResponse,
        "The uploaded image failed security validation.",
      ),
    );
  return (await completeResponse.json()) as MediaAsset;
}
