"use client";

import { useEffect } from "react";

/**
 * Full page navigation once `to` is set. Used after sign-in and the welcome
 * step: the destination may be a route handler (/join/[token]) that the
 * client router can't render, and a fresh load picks up the new session.
 */
export function HardRedirect({ to }: { to?: string }) {
  useEffect(() => {
    if (to) window.location.replace(to);
  }, [to]);
  return null;
}
