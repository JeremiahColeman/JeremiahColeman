import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Functions, and Route Handlers.
 * It acts as the signed-in user (anon key + their session cookie), so every
 * query is subject to row-level security. The service role key is never used.
 */
export async function createClient() {
  // Per-user data is only ever read at request time: never prerendered,
  // prefetched into a shared shell, or cached.
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
