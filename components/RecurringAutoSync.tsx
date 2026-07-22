"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  formatAutoSyncToast,
  syncDueRecurringItems,
} from "@/lib/recurring-sync";

/**
 * 全局初始化：登录后任意页面挂载时检查到期周期项并写入主账单。
 * 同会话内只跑一次，避免路由切换重复 toast。
 */
export function RecurringAutoSync() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const created = await syncDueRecurringItems();
          const message = formatAutoSyncToast(created);
          if (message) toast.success(message);
        } catch {
          // best-effort
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
