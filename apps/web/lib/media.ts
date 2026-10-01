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
export async function uploadMedia(
  file: File,
  workspaceId: string,
): Promise<MediaAsset> {
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
  if (!intentResponse.ok) throw new Error("Use JPG, PNG, or WebP under 10 MB.");
  const intent = (await intentResponse.json()) as {
    assetId: string;
    uploadUrl: string;
  };
  const uploadResponse = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadResponse.ok)
    throw new Error("The image could not be sent to secure storage.");
  const completeResponse = await fetch(
    `${API_URL}/media/${intent.assetId}/complete`,
    { method: "POST", credentials: "include" },
  );
  if (!completeResponse.ok)
    throw new Error("The image failed security validation.");
  return (await completeResponse.json()) as MediaAsset;
}
