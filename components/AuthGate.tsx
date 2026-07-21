"use client";

import { FormEvent, useEffect, useState } from "react";
import { CatAvatar } from "@/components/CatAvatar";

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
      setError("密码不正确哦");
      return;
    }

    localStorage.setItem(STORAGE_KEY, APP_PASSWORD);
    setAuthenticated(true);
    setPassword("");
    setError("");
  }

  if (!ready) {
    return <div className="min-h-dvh bg-[#FAF6EC]" />;
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#FAF6EC] px-6">
        <section className="w-full max-w-sm rounded-[2rem] bg-white p-7 shadow-sm">
          <div className="mb-6 grid size-16 place-items-center rounded-full bg-[#FFE8B8] shadow-sm">
            <CatAvatar size={52} />
          </div>
          <p className="text-sm font-medium text-[#F8A055]">钱包小猫</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#5C4A32]">
            欢迎回来
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#9A7B55]">
            输入密码，小猫就帮你打开账本。
          </p>

          <form className="mt-7 space-y-3" onSubmit={unlock}>
            <label className="sr-only" htmlFor="app-password">
              访问密码
            </label>
            <input
              autoComplete="current-password"
              autoFocus
              className="h-13 w-full rounded-2xl border border-[#F0E6C8] bg-[#FFFDF0] px-4 text-base text-[#5C4A32] outline-none transition-all focus:border-[#F8A055] focus:ring-4 focus:ring-[#F8A055]/15"
              id="app-password"
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              placeholder="请输入密码"
              type="password"
              value={password}
            />
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <button
              className="h-13 w-full rounded-2xl bg-[#F8A055] font-medium text-white shadow-sm transition-all active:scale-95"
              type="submit"
            >
              开始记账
            </button>
          </form>
        </section>
      </main>
    );
  }

  return children;
}
