"use client";

// Resizes and re-encodes an image in the browser before upload, so customer
// menu photos load fast on a phone. Scales the longest edge down to maxDim and
// exports JPEG at the given quality. Returns a Blob (usually well under 200 KB).
export async function compressImage(
  file: File,
  maxDim = 1200,
  quality = 0.82,
): Promise<Blob> {
  let width: number;
  let height: number;
  let drawable: CanvasImageSource;
  let cleanup: (() => void) | null = null;

  // createImageBitmap isn't available everywhere (older Safari, some webviews)
  // — fall back to a plain <img> + object URL, which every browser supports.
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    drawable = bitmap;
    cleanup = () => bitmap.close?.();
  } else {
    const url = URL.createObjectURL(file);
    cleanup = () => URL.revokeObjectURL(url);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load image"));
      el.src = url;
    });
    width = img.naturalWidth;
    height = img.naturalHeight;
    drawable = img;
  }

  try {
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return smallEnough(file) ? file : Promise.reject(new Error("Canvas not supported"));

    // Paint a white backdrop first — otherwise a transparent PNG flattens to
    // black once re-encoded as an opaque JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(drawable, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (!blob) {
      // Canvas encoding failed outright (some in-app browsers block toBlob).
      // If the original is already small, ship it as-is rather than fail the
      // whole upload over a cosmetic resize/re-encode step.
      if (smallEnough(file)) return file;
      throw new Error("Could not process image");
    }
    return blob;
  } finally {
    cleanup?.();
  }
}

function smallEnough(file: File): boolean {
  return file.size <= 500 * 1024;
}
