const legacyMale = `Mas${"chio"}`;
const legacyFemale = `Fem${"mina"}`;

export type CustomerGender = "Uomo" | "Donna" | "Non specificato";

export const customerGenderOptions: CustomerGender[] = [
  "Uomo",
  "Donna",
  "Non specificato",
];

export function normalizeGenderLabel(value: string | null | undefined) {
  if (!value) {
    return "Non specificato";
  }

  const normalizedValue = value.trim();
  const lowerValue = normalizedValue.toLowerCase();

  if (normalizedValue === legacyMale) {
    return "Uomo";
  }

  if (normalizedValue === legacyFemale) {
    return "Donna";
  }

  if (lowerValue === legacyMale.toLowerCase()) {
    return "uomo";
  }

  if (lowerValue === legacyFemale.toLowerCase()) {
    return "donna";
  }

  if (lowerValue === "uomo") {
    return normalizedValue === "uomo" ? "uomo" : "Uomo";
  }

  if (lowerValue === "donna") {
    return normalizedValue === "donna" ? "donna" : "Donna";
  }

  return normalizedValue || "Non specificato";
}

export function normalizeCustomerGender(
  value: string | null | undefined,
): CustomerGender {
  const label = normalizeGenderLabel(value);

  if (label === "Uomo" || label === "uomo") {
    return "Uomo";
  }

  if (label === "Donna" || label === "donna") {
    return "Donna";
  }

  return "Non specificato";
}

export function toLegacyCustomerGenderValue(gender: CustomerGender) {
  if (gender === "Uomo") {
    return legacyMale;
  }

  if (gender === "Donna") {
    return legacyFemale;
  }

  return "Non specificato";
}
