"use client";

import { useState } from "react";

/** A store's product picture, or a gift placeholder if there's none or it fails to load. */
export function ItemImage({ src, alt = "", className = "size-20" }: { src: string | null; alt?: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <div aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl bg-pine-soft text-3xl ${className}`}>
        🎁
      </div>
    );
  }
  return (
    // External store images: plain <img>, and no referrer sent to the store.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className={`shrink-0 rounded-xl border border-line bg-white object-contain ${className}`}
    />
  );
}
