"use client";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { ToastProvider } from "@/components/ui/toast";

// LazyMotion + `m` keeps the motion bundle small (architecture.md §13); reducedMotion="user" honours the OS setting.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ToastProvider>{children}</ToastProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
