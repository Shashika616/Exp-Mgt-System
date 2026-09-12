"use client";
import { createContext, useContext } from "react";

export type StaffUser = { id: string; fullName: string; roleId: string; workload?: number };
export type CategoryOption = { id: string; name: string; parentId: string | null };
export type Directory = { staff: StaffUser[]; categories: CategoryOption[]; canned: { id: string; title: string; shortcut: string | null; body: string }[] };

const Ctx = createContext<Directory>({ staff: [], categories: [], canned: [] });

/** Staff/category/canned lists loaded once per page and shared by pickers (assignee, category, bulk bar). */
export function DirectoryProvider({ value, children }: { value: Directory; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useDirectory() {
  return useContext(Ctx);
}
export function useStaffDirectory() {
  return useContext(Ctx).staff;
}
