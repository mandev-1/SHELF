import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Database-only Supabase client (no Auth). The anon key ships in the browser
// bundle — RLS on the budgets table is permissive, so anyone with the app URL
// can read/edit the shared budget. That's the "shared link" model.
export const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
