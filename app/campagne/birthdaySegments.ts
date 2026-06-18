export type BirthdayCampaignSegmentStatus =
  | "birthday:today"
  | "birthday:next-7"
  | "birthday:month";

export type BirthdaySegmentConfig = {
  objective: string;
  status: BirthdayCampaignSegmentStatus;
  title: string;
};

export const birthdayCampaignSegments: BirthdaySegmentConfig[] = [
  {
    objective: "Contatta i clienti che compiono gli anni oggi con un augurio curato e una proposta gentile.",
    status: "birthday:today",
    title: "Compleanni oggi",
  },
  {
    objective: "Prepara in anticipo gli auguri e le proposte beauty per i compleanni della settimana.",
    status: "birthday:next-7",
    title: "Prossimi 7 giorni",
  },
  {
    objective: "Pianifica una campagna mensile per trasformare i compleanni in nuove prenotazioni.",
    status: "birthday:month",
    title: "Compleanni del mese",
  },
];

function parseBirthDate(birthDate: string | null | undefined) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return null;
  }

  const [year, month, day] = birthDate.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day;

  return isValidDate ? { day, month, year } : null;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getBirthdayDateInYear(
  birthDate: string | null | undefined,
  year: number,
) {
  const parsedBirthDate = parseBirthDate(birthDate);

  if (!parsedBirthDate) {
    return null;
  }

  const birthdayDate = new Date(year, parsedBirthDate.month - 1, parsedBirthDate.day);

  if (
    birthdayDate.getMonth() !== parsedBirthDate.month - 1 ||
    birthdayDate.getDate() !== parsedBirthDate.day
  ) {
    return null;
  }

  return birthdayDate;
}

export function getBirthdayOccurrence(
  birthDate: string | null | undefined,
  today = new Date(),
) {
  const parsedBirthDate = parseBirthDate(birthDate);

  if (!parsedBirthDate) {
    return null;
  }

  const birthdayThisYear = getBirthdayDateInYear(
    birthDate,
    today.getFullYear(),
  );

  if (!birthdayThisYear) {
    return null;
  }

  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const birthdayDate =
    birthdayThisYear < todayDate
      ? getBirthdayDateInYear(birthDate, today.getFullYear() + 1)
      : birthdayThisYear;

  if (!birthdayDate) {
    return null;
  }

  const daysUntil = Math.round(
    (birthdayDate.getTime() - todayDate.getTime()) / 86_400_000,
  );

  return {
    ageTurning: birthdayDate.getFullYear() - parsedBirthDate.year,
    date: birthdayDate,
    dateKey: toDateKey(birthdayDate),
    daysUntil,
  };
}

export function getBirthdayCampaignOccurrence(
  birthDate: string | null | undefined,
  segmentStatus: BirthdayCampaignSegmentStatus,
  today = new Date(),
) {
  const parsedBirthDate = parseBirthDate(birthDate);

  if (!parsedBirthDate) {
    return null;
  }

  if (segmentStatus === "birthday:month") {
    const birthdayDate = getBirthdayDateInYear(birthDate, today.getFullYear());

    if (!birthdayDate) {
      return null;
    }

    return {
      ageTurning: birthdayDate.getFullYear() - parsedBirthDate.year,
      date: birthdayDate,
      dateKey: toDateKey(birthdayDate),
      daysUntil: Math.round(
        (
          birthdayDate.getTime() -
          new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
        ) / 86_400_000,
      ),
    };
  }

  return getBirthdayOccurrence(birthDate, today);
}

export function formatBirthdayDate(dateKey: string) {
  if (!dateKey) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateKey}T00:00:00`));
}

export function matchesBirthdaySegment(
  birthDate: string | null | undefined,
  segmentStatus: BirthdayCampaignSegmentStatus,
  today = new Date(),
) {
  const parsedBirthDate = parseBirthDate(birthDate);

  if (!parsedBirthDate) {
    return false;
  }

  if (segmentStatus === "birthday:month") {
    return parsedBirthDate.month === today.getMonth() + 1;
  }

  const occurrence = getBirthdayOccurrence(birthDate, today);

  if (!occurrence) {
    return false;
  }

  if (segmentStatus === "birthday:today") {
    return occurrence.daysUntil === 0;
  }

  return occurrence.daysUntil >= 0 && occurrence.daysUntil <= 7;
}

export function isBirthdayCampaignSegmentStatus(
  status: string,
): status is BirthdayCampaignSegmentStatus {
  return birthdayCampaignSegments.some((segment) => segment.status === status);
}

export function getBirthdayCampaignSegment(
  status: BirthdayCampaignSegmentStatus,
) {
  return birthdayCampaignSegments.find((segment) => segment.status === status) ?? null;
}
