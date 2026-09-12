import type { Role } from "@/lib/domain/types";

export type NavItem = { href: string; label: string; icon: "dashboard" | "tickets" | "work" | "review" | "clients" | "reports" | "admin"; badge?: number; exact?: boolean };

export function navFor(role: Role, counts: { review: number; myWork: number; unassigned: number }): NavItem[] {
  const items: NavItem[] = [{ href: "/app", label: "Dashboard", icon: "dashboard", exact: true }];
  if (role === "developer") items.push({ href: "/app/tickets", label: "My work", icon: "work", badge: counts.myWork });
  else items.push({ href: "/app/tickets", label: "Tickets", icon: "tickets", badge: counts.unassigned });
  if (role === "lead" || role === "admin") items.push({ href: "/app/review", label: "Review", icon: "review", badge: counts.review });
  if (role !== "developer") items.push({ href: "/app/clients", label: "Clients", icon: "clients" });
  if (role === "lead" || role === "admin") items.push({ href: "/app/reports", label: "Reports", icon: "reports" });
  if (role === "admin") items.push({ href: "/app/admin", label: "Admin", icon: "admin" });
  return items;
}

