export type AgeCampaignSegmentStatus =
  | "age:18-25"
  | "age:26-35"
  | "age:36-50"
  | "age:50-plus";

export type AgeSegmentConfig = {
  maxAge: number | null;
  minAge: number;
  objective: string;
  status: AgeCampaignSegmentStatus;
  title: string;
  tone: string;
};

export const ageCampaignSegments: AgeSegmentConfig[] = [
  {
    maxAge: 25,
    minAge: 18,
    objective: "Promuovi trattamenti beauty freschi, luminosi e facili da prenotare.",
    status: "age:18-25",
    title: "Clienti 18-25 anni",
    tone: "tono fresco e leggero, trattamento beauty o glow-up",
  },
  {
    maxAge: 35,
    minAge: 26,
    objective: "Promuovi cura personale, mantenimento e trattamenti premium semplici.",
    status: "age:26-35",
    title: "Clienti 26-35 anni",
    tone: "tono premium ma semplice, cura personale e mantenimento",
  },
  {
    maxAge: 50,
    minAge: 36,
    objective: "Promuovi trattamenti viso/corpo mirati, prevenzione e benessere.",
    status: "age:36-50",
    title: "Clienti 36-50 anni",
    tone: "tono professionale, trattamenti viso/corpo, prevenzione e benessere",
  },
  {
    maxAge: null,
    minAge: 51,
    objective: "Promuovi benessere, cura e trattamenti premium con tono elegante.",
    status: "age:50-plus",
    title: "Clienti 50+ anni",
    tone: "tono elegante, benessere, cura e trattamento premium",
  },
];

export function calculateAge(birthDate: string | null | undefined) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return null;
  }

  const [year, month, day] = birthDate.split("-").map(Number);
  const parsedBirthDate = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    parsedBirthDate.getUTCFullYear() === year &&
    parsedBirthDate.getUTCMonth() === month - 1 &&
    parsedBirthDate.getUTCDate() === day;

  if (!isValidDate) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const hasBirthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function getAgeSegmentStatus(age: number | null) {
  if (age === null) {
    return null;
  }

  const segment = ageCampaignSegments.find((item) => {
    const isAboveMinimum = age >= item.minAge;
    const isBelowMaximum = item.maxAge === null || age <= item.maxAge;

    return isAboveMinimum && isBelowMaximum;
  });

  return segment?.status ?? null;
}

export function isAgeCampaignSegmentStatus(
  status: string,
): status is AgeCampaignSegmentStatus {
  return ageCampaignSegments.some((segment) => segment.status === status);
}

export function getAgeCampaignSegment(status: AgeCampaignSegmentStatus) {
  return ageCampaignSegments.find((segment) => segment.status === status) ?? null;
}
