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

const { data: customer, error: customerError } = await supabase
  .from("customers")
  .select("id,email,total_spent")
  .eq("email", "noemi.deluca.demo@beautyos.it")
  .single();

if (customerError) {
  console.error(customerError);
  process.exit(1);
}

const { data, error } = await supabase
  .from("appointments")
  .select("id,customer_id,service_name,appointment_date,amount,notes")
  .eq("customer_id", customer.id)
  .order("appointment_date", { ascending: true });

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(JSON.stringify({ customer, appointments: data }, null, 2));
