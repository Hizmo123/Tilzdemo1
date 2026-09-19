"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/compress-image";
import { uploadStandProductImage, removeStandProductImage } from "./image-actions";

export function ProductImageUploader({
  productId,
  imageUrl,
}: {
  productId: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const fd = new FormData();
      fd.append("file", blob, "photo.jpg");
      const res = await uploadStandProductImage(productId, fd);
      if (res.error) setError(res.error);
      else router.refresh();
    } catch {
      setError("Couldn't process that image.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    setError(null);
    start(async () => {
      const res = await removeStandProductImage(productId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const working = busy || pending;

  return (
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-paper border border-line shrink-0 flex items-center justify-center">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-muted text-center leading-tight px-1">
            No photo
          </span>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={working}
            onClick={() => inputRef.current?.click()}
            className="text-xs rounded-md border border-line px-2.5 py-1.5 hover:border-ink/30 disabled:opacity-50"
          >
            {working ? "Uploading…" : imageUrl ? "Replace photo" : "Add photo"}
          </button>
          {imageUrl && !working && (
            <button
              type="button"
              onClick={remove}
              className="text-xs text-muted hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
    </div>
  );
}
