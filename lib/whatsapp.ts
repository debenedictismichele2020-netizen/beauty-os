export function sanitizeMessage(text: string) {
  return text
    .replace(/\uFFFD/g, "")
    .replace(/�/g, "")
    .normalize("NFC")
    .trim();
}

export function cleanWhatsAppMessage(message: string) {
  return sanitizeMessage(message);
}

export function getSafeCampaignEmoji(
  campaignType: string,
  selectedServices: string[] = [],
) {
  const normalizedCampaignType = campaignType.toLowerCase();
  const normalizedServices = selectedServices.map((service) =>
    service.toLowerCase(),
  );

  if (normalizedCampaignType.includes("birthday") || normalizedCampaignType.includes("compleanno")) {
    return "🎂";
  }

  if (
    normalizedServices.some((service) =>
      service.includes("massaggio relax"),
    )
  ) {
    return "🌿";
  }

  if (
    normalizedServices.some(
      (service) => service.includes("manicure") || service.includes("pedicure"),
    )
  ) {
    return "💅";
  }

  if (
    normalizedServices.some(
      (service) =>
        service.includes("trattamento viso") || service.includes("pulizia viso"),
    )
  ) {
    return "✨";
  }

  if (normalizedCampaignType.includes("age:") || normalizedCampaignType.includes("età")) {
    return "✨";
  }

  if (normalizedCampaignType.includes("vip")) {
    return "⭐";
  }

  if (
    normalizedCampaignType.includes("recupero") ||
    normalizedCampaignType.includes("rischio") ||
    normalizedCampaignType.includes("perso") ||
    normalizedCampaignType.includes("lost") ||
    normalizedCampaignType.includes("at risk")
  ) {
    return "😊";
  }

  return "";
}

export function buildFinalWhatsAppMessage(
  message: string,
  campaignType: string,
  selectedServices: string[] = [],
  options: { emojiStyle?: string } = {},
) {
  const clean = sanitizeMessage(message);

  if (options.emojiStyle === "Nessuna emoji") {
    return clean;
  }

  const emoji = getSafeCampaignEmoji(campaignType, selectedServices);

  if (!emoji) {
    return clean;
  }

  const messageWithGreetingEmoji = clean.replace(
    /^Ciao ([^,!.]+)([,.!]?)\s*/i,
    `Ciao $1 ${emoji} `,
  );

  return messageWithGreetingEmoji === clean ? `${emoji} ${clean}`.trim() : messageWithGreetingEmoji;
}

export function cleanWhatsAppPhone(phone: string): string {
  let clean = String(phone ?? "").replace(/\D/g, "");

  if (!clean) {
    return "";
  }

  if (clean.startsWith("00")) {
    clean = clean.slice(2);
  }

  if (clean.startsWith("0")) {
    clean = `39${clean.slice(1)}`;
  }

  if (!clean.startsWith("39")) {
    clean = `39${clean}`;
  }

  return clean;
}

export function buildWhatsAppUrl({
  phone,
  message,
  target,
}: {
  phone: string;
  message: string;
  target: "web" | "mobile";
}): string {
  const cleanPhone = cleanWhatsAppPhone(phone);
  const finalMessage = String(message ?? "").normalize("NFC").trim();
  const encodedMessage = encodeURIComponent(finalMessage);

  if (target === "web") {
    return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
  }

  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
