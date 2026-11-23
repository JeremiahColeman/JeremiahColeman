// Loads connection details for the local Supabase stack from `supabase status`,
// so no keys are committed. Requires `npx supabase start` first.
import { execSync } from "node:child_process";

if (!process.env.SUPABASE_URL) {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  for (const line of out.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) process.env[`LOCAL_${m[1]}`] = m[2];
  }
  process.env.SUPABASE_URL = process.env.LOCAL_API_URL;
  process.env.SUPABASE_ANON_KEY = process.env.LOCAL_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.LOCAL_SERVICE_ROLE_KEY;
  process.env.SUPABASE_DB_URL = process.env.LOCAL_DB_URL;
}
