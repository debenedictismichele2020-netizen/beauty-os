import { createClient, type User } from "@supabase/supabase-js";

export type ProvisionedSalon = {
  id: string;
  name: string;
  role: string;
  slug: string | null;
};

type SalonRow = {
  created_at?: string | null;
  id: string;
  name: string;
  slug: string | null;
};

type MembershipRow = {
  created_at?: string | null;
  id?: string;
  role: string;
  salon_id: string;
};

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function resolveSalonName(user: User) {
  const metadataSalonName = user.user_metadata?.salon_name;

  if (typeof metadataSalonName === "string" && metadataSalonName.trim()) {
    return metadataSalonName.trim();
  }

  return "Nuovo salone";
}

function createBaseSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "nuovo-salone";
}

function createSalonSlug(name: string, userId: string, attempt = 0) {
  const stableUserSuffix = userId.replaceAll("-", "").slice(0, 8 + attempt);

  return `${createBaseSlug(name)}-${stableUserSuffix}`;
}

function mapSalon(
  salon: SalonRow | null,
  membership: Pick<MembershipRow, "role"> | null,
): ProvisionedSalon | null {
  if (!salon?.id) {
    return null;
  }

  return {
    id: salon.id,
    name: salon.name || "Nuovo salone",
    role: membership?.role ?? "owner",
    slug: salon.slug ?? null,
  };
}

function getCreatedAtValue(row: { created_at?: string | null }) {
  const time = row.created_at ? new Date(row.created_at).getTime() : 0;

  return Number.isFinite(time) ? time : 0;
}

function chooseCanonicalMembership(rows: MembershipRow[]) {
  return [...rows].sort((first, second) => {
    if (first.role === "owner" && second.role !== "owner") {
      return -1;
    }

    if (first.role !== "owner" && second.role === "owner") {
      return 1;
    }

    return getCreatedAtValue(first) - getCreatedAtValue(second);
  })[0];
}

async function getExistingMembership(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("salon_members")
    .select("id,role,salon_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<MembershipRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return chooseCanonicalMembership(data ?? []);
}

export async function ensureSalonForUser(
  user: User,
): Promise<ProvisionedSalon | null> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const existingMembership = await getExistingMembership(supabase, user.id);

  if (existingMembership?.salon_id) {
    const { data: existingSalon, error: salonReadError } = await supabase
      .from("salons")
      .select("id,name,slug,created_at")
      .eq("id", existingMembership.salon_id)
      .maybeSingle<SalonRow>();

    if (salonReadError) {
      throw new Error(salonReadError.message);
    }

    return mapSalon(existingSalon, existingMembership);
  }

  const salonName = resolveSalonName(user);
  const { data: ownedSalons, error: ownedSalonsError } = await supabase
    .from("salons")
    .select("id,name,slug,created_at")
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<SalonRow[]>();

  if (ownedSalonsError) {
    throw new Error(ownedSalonsError.message);
  }

  const existingOwnedSalon = ownedSalons?.[0];

  if (existingOwnedSalon?.id) {
    const { error: membershipUpsertError } = await supabase
      .from("salon_members")
      .upsert(
        {
          role: "owner",
          salon_id: existingOwnedSalon.id,
          user_id: user.id,
        },
        { onConflict: "salon_id,user_id" },
      );

    if (membershipUpsertError) {
      throw new Error(membershipUpsertError.message);
    }

    return mapSalon(existingOwnedSalon, { role: "owner" });
  }

  let salon: SalonRow | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("salons")
      .insert({
        country: "IT",
        name: salonName,
        owner_user_id: user.id,
        slug: createSalonSlug(salonName, user.id, attempt),
        timezone: "Europe/Rome",
      })
      .select("id,name,slug,created_at")
      .single<SalonRow>();

    if (!error && data?.id) {
      salon = data;
      break;
    }

    if (error?.code !== "23505") {
      throw new Error(error?.message ?? "Impossibile creare il salone.");
    }

    const { data: concurrentOwnedSalons, error: concurrentReadError } =
      await supabase
        .from("salons")
        .select("id,name,slug,created_at")
        .eq("owner_user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .returns<SalonRow[]>();

    if (concurrentReadError) {
      throw new Error(concurrentReadError.message);
    }

    if (concurrentOwnedSalons?.[0]?.id) {
      salon = concurrentOwnedSalons[0];
      break;
    }
  }

  if (!salon?.id) {
    throw new Error("Impossibile creare uno slug salone univoco.");
  }

  const { error: membershipInsertError } = await supabase
    .from("salon_members")
    .insert({
      role: "owner",
      salon_id: salon.id,
      user_id: user.id,
    });

  if (membershipInsertError) {
    if (membershipInsertError.code === "23505") {
      return ensureSalonForUser(user);
    }

    throw new Error(membershipInsertError.message);
  }

  return mapSalon(salon, { role: "owner" });
}
