"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ensureUserSalon, getCurrentUser, signOut } from "@/lib/auth";

type SidebarAccountState = {
  email: string;
  salonName: string;
};

export default function SidebarAccountPanel() {
  const router = useRouter();
  const [account, setAccount] = useState<SidebarAccountState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      const user = await getCurrentUser();
      const salon = user ? await ensureUserSalon() : null;

      if (!isMounted) {
        return;
      }

      setAccount(
        user
          ? {
              email: user.email ?? "Utente Beauty OS",
              salonName: salon?.name ?? "Studio Beauty",
            }
          : null,
      );
      setIsLoading(false);
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

  return (
    <div className="flex items-center gap-3 rounded-[1.15rem] border border-black/10 bg-white p-3 shadow-sm">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
        {account?.email ? account.email.slice(0, 2).toUpperCase() : "OS"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-black">
          {isLoading ? "Verifica accesso..." : account?.email ?? "Accesso richiesto"}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {account?.salonName ?? "Studio Beauty"}
        </p>
      </div>
      {account ? (
        <button
          aria-label="Esci"
          className="grid size-8 shrink-0 place-items-center rounded-full border border-black/10 text-zinc-600 transition hover:border-black/20 hover:bg-zinc-50 hover:text-black"
          onClick={handleSignOut}
          type="button"
        >
          <LogOut aria-hidden="true" size={15} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
