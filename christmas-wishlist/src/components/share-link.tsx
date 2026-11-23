"use client";

import { useState } from "react";
import { Button, inputClass } from "@/components/ui";

export function ShareLink({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the field below is selectable instead.
    }
  }

  return (
    <div className="space-y-3">
      <input
        readOnly
        value={url}
        aria-label="Invite link"
        onFocus={(e) => e.currentTarget.select()}
        className={`${inputClass} text-base`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" onClick={copy} aria-live="polite">
          {copied ? "Copied!" : "Copy invite link"}
        </Button>
        {canShare ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigator.share({ title, text: `Here's my wishlist: ${title}`, url }).catch(() => {})}
          >
            Share…
          </Button>
        ) : null}
      </div>
    </div>
  );
}
