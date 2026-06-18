import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

  if (match) {
    process.env[match[1]] = match[2];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Configurazione Supabase amministrativa mancante: aggiungere SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const today = new Date("2026-06-18T00:00:00");

const services = [
  ["pulizia-viso", "Pulizia viso", "Viso", 55, 45],
  ["trattamento-viso", "Trattamento viso", "Viso", 75, 60],
  ["percorso-viso-premium", "Percorso viso premium", "Viso", 160, 90],
  ["laminazione-ciglia", "Laminazione ciglia", "Viso", 60, 60],
  ["design-sopracciglia", "Design sopracciglia", "Viso", 35, 30],
  ["trattamento-corpo", "Trattamento corpo", "Corpo", 85, 75],
  ["massaggio-drenante", "Massaggio drenante", "Corpo", 80, 60],
  ["massaggio-relax", "Massaggio relax", "Relax", 70, 60],
  ["manicure", "Manicure", "Nails", 35, 45],
  ["semipermanente", "Semipermanente", "Nails", 50, 60],
  ["pedicure", "Pedicure", "Nails", 45, 50],
  ["depilazione", "Depilazione", "Corpo", 45, 45],
  ["barba-grooming-uomo", "Barba / grooming uomo", "Barber", 35, 30],
  ["trattamento-cute", "Trattamento cute", "Hair", 65, 50],
  ["rituale-viso-corpo", "Rituale viso e corpo", "Corpo", 190, 120],
].map(([local_service_id, name, category, average_price, average_duration_minutes]) => ({
  active: true,
  average_duration_minutes,
  average_price,
  category,
  local_service_id,
  name,
}));

const serviceByName = new Map(services.map((service) => [service.name, service]));

const profiles = [
  profile("Valentina", "Ferrari", "valentina.ferrari.demo@beautyos.it", "393471234501", "Femmina", "1981-06-06", "VIP", "2026-06-09", 18, 8, ["Percorso viso premium", "Rituale viso e corpo", "Semipermanente"], "Cliente VIP costante, interessata a percorsi viso premium e cura mani."),
  profile("Alessandro", "Conti", "alessandro.conti.demo@beautyos.it", "393291234502", "Maschio", "1976-09-16", "VIP", "2026-06-05", 21, 9, ["Trattamento cute", "Barba / grooming uomo", "Percorso viso premium"], "Cliente VIP puntuale, alterna grooming, trattamento cute e skincare viso."),
  profile("Sofia", "Romano", "sofia.romano.demo@beautyos.it", "393471234511", "Femmina", "1988-03-14", "VIP", "2026-06-12", 20, 9, ["Rituale viso e corpo", "Percorso viso premium", "Laminazione ciglia"], "Cliente VIP orientata a rituali premium e trattamenti viso avanzati."),
  profile("Matteo", "Greco", "matteo.greco.demo@beautyos.it", "393331234512", "Maschio", "1983-11-22", "VIP", "2026-06-08", 24, 9, ["Trattamento cute", "Barba / grooming uomo", "Percorso viso premium"], "Cliente VIP grooming con buona continuità e ticket medio elevato."),

  profile("Michele", "De Benedictis", "debenedictismichele2020@gmail.com", "3894871142", "Maschio", "2002-07-10", "Fedele", "2026-06-10", 18, 5, ["Pulizia viso", "Trattamento viso", "Depilazione"], "Cliente abituale, torna con regolarità per viso e depilazione."),
  profile("Mario", "Rossi", "mario.rossi.demo@beautyos.it", "393331234513", "Maschio", "2001-11-09", "Fedele", "2026-06-08", 30, 5, ["Barba / grooming uomo", "Pulizia viso", "Trattamento cute"], "Cliente fedele, preferisce servizi grooming essenziali."),
  profile("Chiara", "Moretti", "chiara.moretti.demo@beautyos.it", "393481234503", "Femmina", "1984-12-25", "Fedele", "2026-06-02", 28, 5, ["Laminazione ciglia", "Design sopracciglia", "Trattamento viso"], "Cliente regolare per ciglia, sopracciglia e trattamenti viso."),
  profile("Federico", "Marini", "federico.marini.demo@beautyos.it", "393331234504", "Maschio", "1998-07-12", "Fedele", "2026-06-01", 30, 5, ["Trattamento cute", "Barba / grooming uomo", "Pulizia viso"], "Cliente fedele interessato a grooming e benessere della cute."),
  profile("Elena", "Rinaldi", "elena.rinaldi.demo@beautyos.it", "393461234505", "Femmina", "1975-02-13", "Fedele", "2026-05-28", 35, 5, ["Semipermanente", "Pedicure", "Manicure"], "Cliente fedele ai servizi mani e piedi, risponde bene ai promemoria soft."),
  profile("Biagio", "Vespa", "biagio.vespa.demo@beautyos.it", "393451234514", "Maschio", "1991-04-28", "Fedele", "2026-06-06", 30, 5, ["Barba / grooming uomo", "Pulizia viso", "Massaggio relax"], "Cliente fedele con cadenza mensile e preferenza per grooming e relax."),
  profile("Arianna", "Spada", "arianna.spada.demo@beautyos.it", "393341234515", "Femmina", "1993-07-20", "Fedele", "2026-05-30", 30, 5, ["Trattamento corpo", "Massaggio drenante", "Pulizia viso"], "Cliente fedele, alterna trattamenti corpo e pulizia viso."),
  profile("Beatrice", "Marino", "beatrice.marino.demo@beautyos.it", "393461234516", "Femmina", "1990-01-30", "Fedele", "2026-06-04", 25, 5, ["Semipermanente", "Laminazione ciglia", "Design sopracciglia"], "Cliente fedele per servizi beauty ricorrenti e naturali."),
  profile("Lorenzo", "Ferri", "lorenzo.ferri.demo@beautyos.it", "393351234517", "Maschio", "1986-05-08", "Fedele", "2026-05-29", 28, 5, ["Barba / grooming uomo", "Trattamento cute", "Massaggio relax"], "Cliente fedele con routine grooming e trattamento cute."),
  profile("Francesca", "Sala", "francesca.sala.demo@beautyos.it", "393491234518", "Femmina", "1995-10-19", "Fedele", "2026-06-07", 21, 5, ["Manicure", "Semipermanente", "Pedicure"], "Cliente fedele con appuntamenti regolari per mani e piedi."),

  profile("Sara", "Galli", "sara.galli.demo@beautyos.it", "393401234506", "Femmina", "1978-09-02", "A rischio", "2026-04-25", 25, 4, ["Trattamento viso", "Massaggio drenante", "Pulizia viso"], "In ritardo rispetto alla cadenza abituale; buona opportunità per una proposta viso stagionale."),
  profile("Noemi", "De Luca", "noemi.deluca.demo@beautyos.it", "393491234508", "Femmina", "1978-09-23", "A rischio", "2026-04-20", 24, 4, ["Semipermanente", "Pedicure", "Manicure"], "In ritardo sui servizi nails; consigliato un promemoria personale e non commerciale."),
  profile("Giulia", "Bianchi", "giulia.bianchi.demo@beautyos.it", "393451234519", "Femmina", "1987-07-09", "A rischio", "2026-05-03", 30, 4, ["Pedicure", "Semipermanente", "Manicure"], "Ha superato la frequenza abituale; recuperabile con proposta semplice per mani e piedi."),
  profile("Martina", "Nalenni", "martina.nalenni.demo@beautyos.it", "393471234520", "Femmina", "1999-02-17", "A rischio", "2026-04-29", 30, 4, ["Manicure", "Semipermanente", "Design sopracciglia"], "Cliente con buona risposta ai reminder, ora oltre la cadenza prevista."),
  profile("Elisa", "Fontana", "elisa.fontana.demo@beautyos.it", "393421234521", "Femmina", "1989-08-05", "A rischio", "2026-04-15", 28, 4, ["Trattamento corpo", "Massaggio drenante", "Massaggio relax"], "Percorso corpo interrotto; priorità media con proposta di continuità."),
  profile("Andrea", "Costa", "andrea.costa.demo@beautyos.it", "393361234522", "Maschio", "1982-12-03", "A rischio", "2026-04-18", 30, 4, ["Barba / grooming uomo", "Trattamento cute", "Pulizia viso"], "Cliente grooming in ritardo, buona probabilità di ritorno con contatto diretto."),

  profile("Marta", "Serra", "marta.serra.demo@beautyos.it", "393421234509", "Femmina", "1996-08-17", "Perso", "2026-02-01", 30, 3, ["Trattamento corpo", "Massaggio drenante", "Pulizia viso"], "Assente da diversi mesi; usare un invito di rientro delicato."),
  profile("Riccardo", "Pellegrini", "riccardo.pellegrini.demo@beautyos.it", "393361234510", "Maschio", "1979-05-21", "Perso", "2026-01-10", 45, 3, ["Barba / grooming uomo", "Trattamento cute", "Pulizia viso"], "Cliente perso; proposta semplice e personale, senza pressione commerciale."),
  profile("Davide", "Lombardi", "davide.lombardi.demo@beautyos.it", "393351234507", "Maschio", "1985-05-17", "Perso", "2026-02-15", 30, 3, ["Barba / grooming uomo", "Pulizia viso", "Trattamento cute"], "Ha interrotto la routine grooming; possibile rientro con un messaggio diretto."),

  profile("Luca", "Verdi", "luca.verdi.demo@beautyos.it", "393371234523", "Maschio", "1984-10-04", "Nuovo", "2026-06-18", 30, 1, ["Pulizia viso"], "Nuovo cliente alla prima visita; da accompagnare verso la seconda prenotazione."),
  profile("Camilla", "Ricci", "camilla.ricci.demo@beautyos.it", "393481234524", "Femmina", "1997-04-11", "Nuovo", "2026-06-14", 30, 1, ["Semipermanente"], "Nuova cliente alla prima visita; preferisce un contatto leggero e informativo."),
];

function profile(
  first_name,
  last_name,
  email,
  phone,
  gender,
  birth_date,
  segment,
  lastVisit,
  frequency,
  visitCount,
  serviceNames,
  notes,
) {
  return {
    birth_date,
    email,
    first_name,
    frequency,
    gender,
    last_name,
    lastVisit,
    notes,
    phone,
    segment,
    serviceNames,
    visitCount,
  };
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildAppointments(profileData, customerId, salonId) {
  const visits = [];

  for (let index = 0; index < profileData.visitCount; index += 1) {
    const reverseIndex = profileData.visitCount - index - 1;
    const appointmentDate = addDays(
      profileData.lastVisit,
      -reverseIndex * profileData.frequency,
    );
    const serviceName =
      profileData.serviceNames[index % profileData.serviceNames.length];
    const service = serviceByName.get(serviceName);
    let amount = service.average_price;

    if (
      profileData.segment === "VIP" &&
      !["Percorso viso premium", "Rituale viso e corpo"].includes(serviceName)
    ) {
      amount += 40;
    }

    visits.push({
      amount,
      appointment_date: appointmentDate,
      customer_id: customerId,
      notes: `Visita demo Gold: ${serviceName.toLowerCase()}, esperienza positiva e dati coerenti con il profilo.`,
      salon_id: salonId,
      service_name: serviceName,
    });
  }

  return visits;
}

function daysBetween(fromDate, toDate) {
  return Math.max(
    0,
    Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000),
  );
}

function calculateMetrics(profileData, visits) {
  const totalSpent = visits.reduce((total, visit) => total + visit.amount, 0);
  const daysSinceLastVisit = daysBetween(
    new Date(`${profileData.lastVisit}T00:00:00`),
    today,
  );
  const ratio = daysSinceLastVisit / profileData.frequency;
  let retentionScore;
  let recoveryProbability;
  let aiStatus;

  if (profileData.segment === "Nuovo") {
    aiStatus = "Fedele";
    retentionScore = 74;
    recoveryProbability = 60;
  } else if (profileData.segment === "VIP") {
    aiStatus = "VIP";
    retentionScore = Math.max(90, Math.min(98, Math.round(98 - ratio * 4)));
    recoveryProbability = 85;
  } else if (profileData.segment === "Fedele") {
    aiStatus = "Fedele";
    retentionScore = Math.max(72, Math.min(89, Math.round(90 - ratio * 8)));
    recoveryProbability = visits.length >= 5 ? 72 : 65;
  } else if (profileData.segment === "A rischio") {
    aiStatus = "A rischio";
    retentionScore = Math.max(42, Math.min(68, Math.round(75 - ratio * 10)));
    recoveryProbability = Math.max(48, Math.min(68, Math.round(72 - ratio * 7)));
  } else {
    aiStatus = "Perso";
    retentionScore = Math.max(12, Math.min(38, Math.round(50 - ratio * 7)));
    recoveryProbability = Math.max(15, Math.min(32, Math.round(42 - ratio * 5)));
  }

  return {
    ai_status: aiStatus,
    average_visit_frequency_days: profileData.frequency,
    last_visit_date: profileData.lastVisit,
    recovery_probability: recoveryProbability,
    retention_score: retentionScore,
    total_spent: totalSpent,
  };
}

async function requireSuccess(result, context) {
  if (result.error) {
    console.error(context, result.error);
    process.exit(1);
  }

  return result.data;
}

const normalizeName = (firstName, lastName) =>
  `${firstName ?? ""} ${lastName ?? ""}`.trim().toLocaleLowerCase("it-IT");

const existingCustomers = await requireSuccess(
  await supabase.from("customers").select("*").limit(5000),
  "Errore lettura clienti",
);
const existingAppointments = await requireSuccess(
  await supabase.from("appointments").select("*").limit(5000),
  "Errore lettura appuntamenti",
);
const existingServices = await requireSuccess(
  await supabase.from("services").select("*").limit(5000),
  "Errore lettura servizi",
);
const existingTasks = await requireSuccess(
  await supabase.from("operational_tasks").select("*").limit(5000),
  "Errore lettura task",
);
const backupPath = `/private/tmp/beauty-os-gold-demo-backup-${new Date()
  .toISOString()
  .replaceAll(":", "-")}.json`;
fs.writeFileSync(
  backupPath,
  JSON.stringify(
    {
      created_at: new Date().toISOString(),
      customers: existingCustomers,
      appointments: existingAppointments,
      services: existingServices,
      operational_tasks: existingTasks,
    },
    null,
    2,
  ),
);
const salonIds = [
  ...new Set(existingCustomers.map((customer) => customer.salon_id).filter(Boolean)),
];

if (salonIds.length !== 1) {
  console.error(
    `Dataset Gold richiede un solo salon_id esistente; trovati ${salonIds.length}.`,
  );
  process.exit(1);
}

const salonId = salonIds[0];
const targetNames = new Set(
  profiles.map((item) => normalizeName(item.first_name, item.last_name)),
);
const unexpectedCustomers = existingCustomers.filter(
  (customer) =>
    !targetNames.has(normalizeName(customer.first_name, customer.last_name)),
);

if (unexpectedCustomers.length > 0) {
  console.error(
    "Clienti non previsti nel piano Gold Demo:",
    unexpectedCustomers.map(
      (customer) => `${customer.first_name} ${customer.last_name}`,
    ),
  );
  process.exit(1);
}

await requireSuccess(
  await supabase
    .from("operational_tasks")
    .delete()
    .eq("salon_id", salonId)
    .select("id"),
  "Errore pulizia task demo",
);

await requireSuccess(
  await supabase
    .from("services")
    .delete()
    .eq("local_service_id", "test-supabase")
    .select("id"),
  "Errore eliminazione servizio test",
);

const targetServiceIds = services.map((service) => service.local_service_id);
const removedServiceIds = existingServices
  .filter(
    (service) =>
      service.salon_id === salonId &&
      !targetServiceIds.includes(service.local_service_id),
  )
  .map((service) => service.id);

if (removedServiceIds.length > 0) {
  await requireSuccess(
    await supabase
      .from("services")
      .update({
        active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", removedServiceIds)
      .select("id"),
    "Errore disattivazione servizi fuori catalogo",
  );
}

await requireSuccess(
  await supabase.from("services").upsert(
    services.map((service) => ({
      ...service,
      deleted_at: null,
      salon_id: salonId,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "local_service_id" },
  ),
  "Errore normalizzazione catalogo",
);

const customerByEmail = new Map(
  existingCustomers.map((customer) => [customer.email, customer]),
);
const customerByName = new Map(
  existingCustomers.map((customer) => [
    normalizeName(customer.first_name, customer.last_name),
    customer,
  ]),
);
const finalCustomers = [];

for (const profileData of profiles) {
  const existing =
    customerByEmail.get(profileData.email) ??
    customerByName.get(
      normalizeName(profileData.first_name, profileData.last_name),
    );
  const payload = {
    birth_date: profileData.birth_date,
    email: profileData.email,
    first_name: profileData.first_name,
    gender: profileData.gender,
    last_name: profileData.last_name,
    notes: profileData.notes,
    phone: profileData.phone,
    salon_id: salonId,
  };
  let customer;

  if (existing) {
    customer = await requireSuccess(
      await supabase
        .from("customers")
        .update(payload)
        .eq("id", existing.id)
        .select("id,email")
        .single(),
      `Errore aggiornamento ${profileData.email}`,
    );
  } else {
    customer = await requireSuccess(
      await supabase
        .from("customers")
        .insert(payload)
        .select("id,email")
        .single(),
      `Errore inserimento ${profileData.email}`,
    );
  }

  finalCustomers.push({ ...customer, profileData });
}

const finalCustomerIds = finalCustomers.map((customer) => customer.id);
const deletedAppointments = await requireSuccess(
  await supabase
    .from("appointments")
    .delete()
    .in("customer_id", finalCustomerIds)
    .select("id"),
  "Errore ricostruzione visite",
);

if (
  existingAppointments.length > 0 &&
  deletedAppointments.length !== existingAppointments.length
) {
  console.error(
    `Pulizia appuntamenti incompleta: eliminati ${deletedAppointments.length} di ${existingAppointments.length}. Interruzione per evitare duplicati.`,
  );
  process.exit(1);
}

let appointmentCount = 0;

for (const customer of finalCustomers) {
  const visits = buildAppointments(
    customer.profileData,
    customer.id,
    salonId,
  );
  const metrics = calculateMetrics(customer.profileData, visits);

  await requireSuccess(
    await supabase.from("appointments").insert(visits),
    `Errore inserimento visite ${customer.email}`,
  );
  await requireSuccess(
    await supabase
      .from("customers")
      .update(metrics)
      .eq("id", customer.id)
      .select("id")
      .single(),
    `Errore metriche ${customer.email}`,
  );

  appointmentCount += visits.length;
}

const finalRows = await requireSuccess(
  await supabase
    .from("customers")
    .select(
      "id,email,ai_status,retention_score,recovery_probability,total_spent,average_visit_frequency_days,last_visit_date,created_at",
    )
    .in("id", finalCustomerIds),
  "Errore audit finale clienti",
);
const derivedNewEmails = new Set(
  profiles.filter((item) => item.segment === "Nuovo").map((item) => item.email),
);
const exclusiveCounts = finalRows.reduce(
  (counts, customer) => {
    if (derivedNewEmails.has(customer.email)) {
      counts.Nuovi += 1;
    } else if (customer.ai_status === "VIP") {
      counts.VIP += 1;
    } else if (customer.ai_status === "Fedele") {
      counts.Fedeli += 1;
    } else if (customer.ai_status === "A rischio") {
      counts["A rischio"] += 1;
    } else if (customer.ai_status === "Perso") {
      counts.Persi += 1;
    }

    return counts;
  },
  { VIP: 0, Fedeli: 0, "A rischio": 0, Persi: 0, Nuovi: 0 },
);
const recoverable = finalRows.filter((customer) =>
  ["A rischio", "Perso"].includes(customer.ai_status),
);
const estimatedRecovery = recoverable.reduce(
  (total, customer) =>
    total +
    Math.round(
      (Number(customer.total_spent) *
        Number(customer.recovery_probability)) /
        100,
    ),
  0,
);

console.log(
  JSON.stringify(
    {
      appointments: appointmentCount,
      backupPath,
      customers: finalRows.length,
      estimatedRecovery,
      exclusiveCounts,
      services: services.length,
      salonId,
    },
    null,
    2,
  ),
);
