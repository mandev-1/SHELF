import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// Database-only Supabase client (no Auth). The anon key ships in the browser
// bundle — RLS on the budgets table is permissive, so anyone with the app URL
// can read/edit the shared budget. That's the "shared link" model.
//
// Created LAZILY (on first use, browser-side) rather than at module load, so
// `next build` can prerender the page without the env vars present — otherwise
// the static export evaluates this module and `createClient(undefined, …)`
// throws "supabaseUrl is required" and fails the build.
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them in Vercel → Settings → Environment Variables (Production), then redeploy.",
    );
  }
  _client = createSupabaseClient(url, key);
  return _client;
}
