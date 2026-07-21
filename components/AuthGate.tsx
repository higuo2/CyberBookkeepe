"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";

const STORAGE_KEY = "cyberbookkeeper_auth";
const APP_PASSWORD = "cyber2026";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAuthenticated(localStorage.getItem(STORAGE_KEY) === APP_PASSWORD);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== APP_PASSWORD) {
      setError("密码不正确");
      return;
    }

    localStorage.setItem(STORAGE_KEY, APP_PASSWORD);
    setAuthenticated(true);
    setPassword("");
    setError("");
  }

  if (!ready) {
    return <div className="min-h-dvh bg-stone-50" />;
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-dvh place-items-center bg-stone-50 px-6">
        <section className="w-full max-w-sm rounded-[2rem] border border-stone-200 bg-white p-7 shadow-xl shadow-stone-200/60">
          <div className="mb-7 flex size-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <LockKeyhole aria-hidden="true" className="size-7" />
          </div>
          <p className="text-sm font-medium text-emerald-700">CyberBookkeeper</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
            欢迎回来
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            输入访问密码以进入你的私人账本。
          </p>

          <form className="mt-7 space-y-3" onSubmit={unlock}>
            <label className="sr-only" htmlFor="app-password">
              访问密码
            </label>
            <input
              autoComplete="current-password"
              autoFocus
              className="h-13 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-base text-stone-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              id="app-password"
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              placeholder="请输入密码"
              type="password"
              value={password}
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              className="h-13 w-full rounded-2xl bg-stone-950 font-medium text-white transition active:scale-[0.98]"
              type="submit"
            >
              解锁账本
            </button>
          </form>
        </section>
      </main>
    );
  }

  return children;
}
