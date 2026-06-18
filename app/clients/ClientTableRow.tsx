"use client";

import type { MouseEvent } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  buildWhatsAppUrl,
  cleanWhatsAppPhone as normalizeWhatsAppPhone,
  isMobileDevice,
} from "@/lib/whatsapp";
import type { Customer } from "./data";
import { isCustomerProfileIncomplete } from "./profileCompleteness";

function cleanWhatsAppPhone(phone: string) {
  const digits = normalizeWhatsAppPhone(phone);

  if (!digits) {
    return null;
  }

  return digits;
}

function stopRowClick(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function stopRowKeyDown(event: KeyboardEvent<HTMLElement>) {
  event.stopPropagation();
}

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="h-5 w-5"
      fill="currentColor"
    >
      <path
        d="M16.03 3C8.86 3 3.04 8.73 3.04 15.8c0 2.26.6 4.47 1.74 6.42L3 29l6.96-1.8a13.14 13.14 0 0 0 6.07 1.5C23.2 28.7 29 22.97 29 15.9 29 8.73 23.2 3 16.03 3Zm0 23.52c-1.9 0-3.75-.5-5.38-1.44l-.38-.22-4.13 1.07 1.1-4.01-.25-.41a11.05 11.05 0 0 1-1.7-5.72c0-5.86 4.82-10.62 10.74-10.62 5.93 0 10.75 4.76 10.75 10.62 0 5.95-4.82 10.73-10.75 10.73Zm5.9-7.96c-.32-.16-1.9-.93-2.2-1.04-.3-.1-.52-.16-.74.16-.22.32-.85 1.04-1.04 1.25-.19.22-.38.24-.7.08-.32-.16-1.36-.5-2.6-1.6-.96-.85-1.6-1.9-1.8-2.22-.18-.32-.02-.49.14-.65.14-.14.32-.38.48-.57.16-.19.22-.32.32-.54.1-.22.05-.4-.03-.57-.08-.16-.74-1.78-1.02-2.44-.27-.64-.54-.55-.74-.56h-.63c-.22 0-.57.08-.87.4-.3.32-1.14 1.12-1.14 2.73s1.17 3.16 1.34 3.38c.16.22 2.3 3.5 5.57 4.9.78.34 1.39.54 1.86.69.78.25 1.49.21 2.05.13.63-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.3-.21-.62-.37Z"
      />
    </svg>
  );
}

export default function ClientTableRow({
  customer,
  priorityClassName,
  priorityLabel,
  statusClassName,
  statusLabel,
}: {
  customer: Customer;
  priorityClassName: string;
  priorityLabel: string;
  statusClassName: string;
  statusLabel: string;
}) {
  const router = useRouter();
  const profileHref = `/clients/${customer.id}`;
  const whatsappPhone = cleanWhatsAppPhone(customer.phone);
  const isIncomplete = isCustomerProfileIncomplete(customer);

  return (
    <tr
      className="cursor-pointer transition hover:bg-zinc-50 focus-within:bg-zinc-50"
      onClick={() => router.push(profileHref)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(profileHref);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <td className="min-w-[320px] px-5 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-950 text-sm font-medium text-white">
            {customer.name
              .split(" ")
              .filter(Boolean)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex max-w-[250px] flex-wrap items-center gap-2">
              <p className="truncate whitespace-nowrap font-medium tracking-tight text-black">
                {customer.name}
              </p>
              {isIncomplete ? (
                <span className="inline-flex whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-semibold text-amber-800">
                  Profilo incompleto
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-[250px] truncate whitespace-nowrap text-sm text-zinc-500">
              {customer.phone} · {customer.email}
            </p>
          </div>
        </div>
      </td>
      <td className="min-w-[170px] whitespace-nowrap px-5 py-4 text-sm text-zinc-700">
        {customer.lastVisit}
      </td>
      <td className="min-w-[130px] whitespace-nowrap px-5 py-4 text-sm font-semibold text-zinc-950">
        {customer.totalSpent}
      </td>
      <td className="min-w-[130px] px-5 py-4">
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClassName}`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="min-w-[140px] px-5 py-4">
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${priorityClassName}`}
        >
          {priorityLabel}
        </span>
      </td>
      <td className="min-w-[160px] px-5 py-4">
        <div
          className="flex items-center gap-2"
          onKeyDown={stopRowKeyDown}
        >
          <Link
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
            href={profileHref}
            onClick={stopRowClick}
          >
            Profilo
          </Link>
          {whatsappPhone ? (
            <button
              aria-label={`Apri WhatsApp per ${customer.name}`}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_10px_24px_rgba(37,211,102,0.24)] transition hover:scale-[1.03] hover:shadow-[0_14px_30px_rgba(37,211,102,0.28)]"
              onClick={(event) => {
                stopRowClick(event);
                const whatsappUrl = buildWhatsAppUrl({
                  phone: whatsappPhone,
                  message: "",
                  target: isMobileDevice() ? "mobile" : "web",
                });

                window.open(whatsappUrl, "_blank", "noopener,noreferrer");
              }}
              title="Apri WhatsApp"
              type="button"
            >
              <WhatsAppIcon />
            </button>
          ) : (
            <button
              aria-label="Telefono mancante"
              className="grid size-10 shrink-0 cursor-not-allowed place-items-center rounded-full border border-black/10 bg-zinc-100 text-zinc-400"
              disabled
              onClick={stopRowClick}
              title="Telefono mancante"
              type="button"
            >
              <WhatsAppIcon />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
