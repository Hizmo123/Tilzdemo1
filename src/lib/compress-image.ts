"use client";

// Resizes and re-encodes an image in the browser before upload, so customer
// menu photos load fast on a phone. Scales the longest edge down to maxDim and
// exports JPEG at the given quality. Returns a Blob (usually well under 200 KB).
export async function compressImage(
  file: File,
  maxDim = 1200,
  quality = 0.82,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
  if (!blob) throw new Error("Could not process image");
  return blob;
}
