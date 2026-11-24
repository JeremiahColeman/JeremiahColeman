// Writes .env.local for local development from `supabase status`.
// Only public values: the URL and the anon key. Never the service role key.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const env = Object.fromEntries(
  out
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const keep = existsSync(".env.local")
  ? readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l && !/^NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)=/.test(l))
  : ["NEXT_PUBLIC_SITE_URL=http://localhost:3000"];

writeFileSync(
  ".env.local",
  [`NEXT_PUBLIC_SUPABASE_URL=${env.API_URL}`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${env.ANON_KEY}`, ...keep, ""].join("\n"),
);
console.log("Wrote .env.local");
