import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

  if (match) {
    process.env[match[1]] = match[2];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

const idsToDelete = [
  "a48a93d3-20f3-4fc2-9d01-302b9cc58d72",
  "1caf5a5b-e924-49c4-833e-495b281be30b",
  "d3c2e78c-e90a-492b-97f2-207941eb8a14",
];

const { data, error } = await supabase
  .from("appointments")
  .delete()
  .in("id", idsToDelete)
  .select("id");

if (error) {
  console.error("Errore eliminazione visite duplicate:", error);
  process.exit(1);
}

console.log(JSON.stringify({ deleted: data?.length ?? 0, rows: data }, null, 2));
