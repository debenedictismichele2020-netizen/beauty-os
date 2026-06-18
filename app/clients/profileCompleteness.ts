type CustomerProfileCompletenessInput = {
  birth_date?: string;
  birthDate: string;
  gender: string;
  notes: string;
  phone: string;
};

export function isCustomerProfileIncomplete(
  customer: CustomerProfileCompletenessInput,
) {
  const hasBirthDate = Boolean(customer.birth_date ?? customer.birthDate);
  const hasPhone =
    Boolean(customer.phone.trim()) && customer.phone !== "Telefono non inserito";
  const hasGender = customer.gender !== "Non specificato";
  const hasNotes =
    Boolean(customer.notes.trim()) &&
    customer.notes !== "Nessuna nota cliente inserita.";

  return !hasBirthDate || !hasPhone || !hasGender || !hasNotes;
}
