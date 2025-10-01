"use client";
import { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/ToastProvider";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
