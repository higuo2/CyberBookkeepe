"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { hydratePlannerFromCloud } from "@/lib/planner-cloud";
import {
  formatAutoSyncToast,
  purgeLegacyDemoRecurringTransactions,
  syncDueRecurringItems,
} from "@/lib/recurring-sync";
import { readRecurringItems } from "@/lib/planner";

/**
 * 全局初始化：先拉云端规划，再检查到期周期项并写入主账单。
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
          await hydratePlannerFromCloud();
          // 先清本地演示种子，再清云端误写入的演示账单
          readRecurringItems();
          await purgeLegacyDemoRecurringTransactions();
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
