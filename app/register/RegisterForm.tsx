"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { isSupabaseAuthConfigured, signUpWithEmail } from "@/lib/auth";

export default function RegisterForm() {
  const router = useRouter();
  const [salonName, setSalonName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSuccess(false);
    setIsSubmitting(true);

    const result = await signUpWithEmail(email, password, salonName);

    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (!result.session) {
      setIsSuccess(true);
      setMessage("Account creato. Controlla la tua email per confermare l’accesso.");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] px-5 py-10 text-zinc-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center">
        <div className="w-full rounded-[1.5rem] border border-black/10 bg-white p-6 shadow-[0_28px_90px_rgba(0,0,0,0.08)]">
          <div>
            <div className="grid size-11 place-items-center rounded-2xl bg-black text-sm font-semibold text-white">
              BO
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
              Beauty OS
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-black">
              Crea account
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Crea il tuo accesso a Beauty OS. Potrai completare i dettagli
              dello studio anche in seguito.
            </p>
          </div>

          {!isSupabaseAuthConfigured() ? (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Supabase Auth non è configurato. Controlla le variabili ambiente prima della registrazione.
            </p>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-zinc-700">
              Nome salone{" "}
              <span className="font-normal text-zinc-400">(opzionale)</span>
              <input
                autoComplete="organization"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                onChange={(event) => setSalonName(event.target.value)}
                type="text"
                value={salonName}
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Email
              <input
                autoComplete="email"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Password
              <input
                autoComplete="new-password"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            {message ? (
              <p
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  isSuccess
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {message}
              </p>
            ) : null}

            <button
              className="w-full rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creazione..." : "Crea account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-zinc-500">
            Hai già un account?{" "}
            <Link className="font-semibold text-black hover:underline" href="/login">
              Accedi
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
