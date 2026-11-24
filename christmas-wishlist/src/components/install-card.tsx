"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

type Platform = "installed" | "ios" | "android" | "other" | "unknown";

function detect(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const noop = () => () => {};

/** Step-by-step "add to home screen" help, written for every phone. */
export function InstallCard() {
  const platform = useSyncExternalStore<Platform>(noop, detect, () => "unknown");
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (platform === "installed" || platform === "unknown") return null;

  return (
    <section aria-labelledby="install" className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 id="install" className="font-display text-xl font-bold">
        Add it to your home screen
      </h2>
      <p>Open Family Wishlist with one tap, like any other app.</p>
      {prompt ? (
        <Button
          className="w-full"
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
        >
          Add to home screen
        </Button>
      ) : platform === "ios" ? (
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            Open this page in <strong>Safari</strong>.
          </li>
          <li>
            Tap the <strong>Share</strong> button (a square with an arrow pointing up).
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
        </ol>
      ) : platform === "android" ? (
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            Open this page in <strong>Chrome</strong>.
          </li>
          <li>
            Tap the <strong>⋮</strong> menu in the top corner.
          </li>
          <li>
            Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.
          </li>
        </ol>
      ) : (
        <p className="text-muted">On a phone, open this page and use your browser&apos;s “Add to Home Screen” option.</p>
      )}
    </section>
  );
}
