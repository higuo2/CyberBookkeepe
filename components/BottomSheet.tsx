"use client";

import type { ReactNode } from "react";
import { Drawer } from "vaul";

export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[90] mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[28px] bg-[#FFFDF0] outline-none"
          // 原生 date/select 弹层会触发 outside 交互，避免误关抽屉
          onPointerDownOutside={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest?.("input[type='date'], select")) {
              event.preventDefault();
            }
          }}
        >
          <div className="mx-auto my-2 h-1.5 w-12 shrink-0 rounded-full bg-[#EFE5D3]" />
          {title ? (
            <Drawer.Title className="px-5 pb-2 text-lg font-extrabold text-[#4A3E3D]">
              {title}
            </Drawer.Title>
          ) : (
            <Drawer.Title className="sr-only">底部面板</Drawer.Title>
          )}
          <div
            className={
              contentClassName ??
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] touch-pan-y"
            }
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
