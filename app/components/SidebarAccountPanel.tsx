"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ensureUserSalon, getCurrentUser, signOut } from "@/lib/auth";

type SidebarAccountState = {
  email: string;
  salonName: string;
};

type SidebarAccountPanelProps = {
  compact?: boolean;
};

const fallbackAccount: SidebarAccountState = {
  email: "Account",
  salonName: "Studio Beauty",
};

export default function SidebarAccountPanel({
  compact = false,
}: SidebarAccountPanelProps) {
  const router = useRouter();
  const [account, setAccount] =
    useState<SidebarAccountState>(fallbackAccount);

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      try {
        const user = await getCurrentUser();
        const salon = user ? await ensureUserSalon() : null;

        if (!isMounted) {
          return;
        }

        setAccount({
          email: user?.email ?? fallbackAccount.email,
          salonName: salon?.name ?? fallbackAccount.salonName,
        });
      } catch {
        if (isMounted) {
          setAccount(fallbackAccount);
        }
      }
    }

    void loadAccount();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  const initials =
    account.email === fallbackAccount.email
      ? "DE"
      : account.email.slice(0, 2).toUpperCase();

  return (
    <div
      className={`flex min-w-0 items-center rounded-[1.15rem] bg-white shadow-sm ${
        compact ? "flex-col gap-2 p-2" : "gap-3 p-3"
      }`}
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
        {initials}
      </div>
      {!compact ? (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-black">
            {account.email}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {account.salonName}
          </p>
        </div>
      ) : null}
      <button
        aria-label="Esci"
        className="grid size-8 shrink-0 place-items-center rounded-full border border-black/10 text-zinc-600 transition hover:border-black/20 hover:bg-zinc-50 hover:text-black"
        onClick={handleSignOut}
        title="Esci"
        type="button"
      >
        <LogOut aria-hidden="true" size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
