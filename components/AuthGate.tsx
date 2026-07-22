"use client";

import { FormEvent, useEffect, useState } from "react";
import { CatAvatar } from "@/components/CatAvatar";
import { useI18n } from "@/components/LocaleProvider";

const STORAGE_KEY = "cyberbookkeeper_auth";
const AUTH_MARKER = "unlocked";

function expectedPassword() {
  return process.env.NEXT_PUBLIC_APP_PASSWORD?.trim() ?? "";
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAuthenticated(localStorage.getItem(STORAGE_KEY) === AUTH_MARKER);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const expected = expectedPassword();
    if (!expected) {
      setError(t("auth.error.notConfigured"));
      return;
    }
    if (password !== expected) {
      setError(t("auth.error.wrongPassword"));
      return;
    }

    localStorage.setItem(STORAGE_KEY, AUTH_MARKER);
    setAuthenticated(true);
    setPassword("");
    setError("");
  }

  if (!ready) {
    return <div className="mx-auto h-dvh w-full max-w-md bg-[#FAF6EC]" />;
  }

  if (!authenticated) {
    return (
      <main className="mx-auto grid h-dvh w-full max-w-md place-items-center overflow-x-hidden bg-[#FAF6EC] px-6 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)] touch-pan-y">
        <section className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-sm">
          <div className="mb-6 grid size-16 place-items-center rounded-full bg-[#FFE8B8] shadow-sm">
            <CatAvatar size={52} />
          </div>
          <p className="text-sm font-medium text-[#EE7828]">{t("auth.brand")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#5C4A32]">
            {t("auth.welcome")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#9A7B55]">
            {t("auth.subtitle")}
          </p>

          <form className="mt-7 space-y-3" onSubmit={unlock}>
            <label className="sr-only" htmlFor="app-password">
              {t("auth.passwordLabel")}
            </label>
            <input
              autoComplete="current-password"
              autoFocus
              className="h-13 w-full rounded-2xl border border-[#EFE5D3] bg-[#FAF6EC] px-4 text-base text-[#5C4A32] outline-none transition-all focus:border-[#EE7828] focus:ring-4 focus:ring-[#EE7828]/15"
              id="app-password"
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              placeholder={t("auth.passwordPlaceholder")}
              type="password"
              value={password}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              className="h-13 w-full rounded-2xl bg-[#EE7828] font-medium text-white shadow-sm transition-all duration-150 active:scale-[0.98]"
              type="submit"
            >
              {t("auth.submit")}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return children;
}
