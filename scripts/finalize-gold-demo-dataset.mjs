import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

  if (match) {
    process.env[match[1]] = match[2];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Aggiungere SUPABASE_SERVICE_ROLE_KEY a .env.local per finalizzare il Dataset Gold Demo.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const requireSuccess = (result, context) => {
  if (result.error) {
    console.error(context, result.error);
    process.exit(1);
  }

  return result.data;
};

const legacyAppointments = requireSuccess(
  await supabase
    .from("appointments")
    .select("id")
    .or("notes.not.like.Visita demo Gold:%,notes.is.null"),
  "Errore lettura visite legacy",
);
const inactiveServices = requireSuccess(
  await supabase
    .from("services")
    .select("id")
    .or("active.eq.false,deleted_at.not.is.null"),
  "Errore lettura servizi dismessi",
);

if (legacyAppointments.length > 0) {
  requireSuccess(
    await supabase
      .from("appointments")
      .delete()
      .in(
        "id",
        legacyAppointments.map((appointment) => appointment.id),
      )
      .select("id"),
    "Errore eliminazione visite legacy",
  );
}

if (inactiveServices.length > 0) {
  requireSuccess(
    await supabase
      .from("services")
      .delete()
      .in(
        "id",
        inactiveServices.map((service) => service.id),
      )
      .select("id"),
    "Errore eliminazione servizi dismessi",
  );
}

const [customersResult, appointmentsResult] = await Promise.all([
  supabase.from("customers").select("*").limit(5000),
  supabase.from("appointments").select("*").limit(5000),
]);
const customers = requireSuccess(customersResult, "Errore lettura clienti");
const appointments = requireSuccess(
  appointmentsResult,
  "Errore lettura appuntamenti",
);

for (const customer of customers) {
  const customerAppointments = appointments.filter(
    (appointment) => appointment.customer_id === customer.id,
  );
  const totalSpent = customerAppointments.reduce(
    (total, appointment) => total + Number(appointment.amount ?? 0),
    0,
  );
  const lastVisitDate = customerAppointments
    .map((appointment) => appointment.appointment_date)
    .sort()
    .at(-1);

  requireSuccess(
    await supabase
      .from("customers")
      .update({
        last_visit_date: lastVisitDate,
        total_spent: totalSpent,
      })
      .eq("id", customer.id)
      .select("id")
      .single(),
    `Errore ricalcolo cliente ${customer.email}`,
  );
}

console.log(
  JSON.stringify(
    {
      appointments: appointments.length,
      customers: customers.length,
      legacyAppointmentsRemoved: legacyAppointments.length,
      inactiveServicesRemoved: inactiveServices.length,
    },
    null,
    2,
  ),
);
