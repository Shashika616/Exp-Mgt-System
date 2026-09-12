"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "./_helpers";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { getAuthProvider } from "@/lib/auth/provider";
import { createCategory, deleteCanned, updateCategory, updateTemplate, upsertCanned } from "@/lib/dal/categories";
import { createOrg, updateGlobalSettings, updateOrg } from "@/lib/dal/orgs";
import { upsertPolicy } from "@/lib/dal/sla";
import { deactivateUser, forceMfaReset, inviteUser, reactivateUser, setUserRole, updateProfile } from "@/lib/dal/users";
import { getStaffOrgId } from "@/lib/dal/orgs";
import { withContext } from "@/lib/dal/db";
import { getEmailProvider } from "@/lib/email/provider";
import { renderAuthEmail } from "@/lib/email/render";
import { CannedSchema, CategorySchema, GlobalSettingsSchema, InviteContactSchema, InviteStaffSchema, OrgSchema, ProfileSchema, SetRoleSchema, SlaPolicySchema, TemplateSchema, UserIdSchema } from "@/lib/schemas/admin";
import { createSavedView, deleteSavedView } from "@/lib/dal/saved-views";
import { SavedViewSchema } from "@/lib/schemas/admin";
import { uuid } from "@/lib/schemas/common";

const revalidate = () => revalidatePath("/app", "layout");

async function sendInvitation(email: string, fullName: string, token: string, orgName: string) {
  const url = `${env.APP_URL}/invite/${token}`;
  const mail = await renderAuthEmail("invitation", { name: fullName, url, orgName });
  await getEmailProvider().send({ to: email, ...mail, tag: "invitation" });
}

/** FR-ADM-01 */
export const inviteStaff = action(InviteStaffSchema, "user.manage", async (ctx, input) => {
  const provider = await getAuthProvider();
  const identity = provider.name === "supabase" ? await provider.createIdentity(input.email) : null;
  const orgId = await withContext(ctx, getStaffOrgId);
  const { userId, token } = await inviteUser(ctx, { ...input, orgId }, { authProviderId: identity?.providerId ?? null });
  await sendInvitation(input.email, input.fullName, token, "EXPENDABLES (PVT) LTD");
  revalidate();
  return { userId };
});

/** FR-ORG-02: admin invites a contact into any client org. */
export const inviteContact = action(InviteContactSchema, "contact.manage", async (ctx, input) => {
  const provider = await getAuthProvider();
  const identity = provider.name === "supabase" ? await provider.createIdentity(input.email) : null;
  const { userId, token } = await inviteUser(ctx, input, { authProviderId: identity?.providerId ?? null });
  const { getOrg } = await import("@/lib/dal/orgs");
  const org = await getOrg(ctx, input.orgId);
  await sendInvitation(input.email, input.fullName, token, org?.name ?? "your organisation");
  revalidate();
  return { userId };
});

export const deactivateUserAction = action(UserIdSchema, ["user.manage", "contact.manage"], async (ctx, input) => {
  const target = await deactivateUser(ctx, input.userId);
  const provider = await getAuthProvider();
  const { getUser } = await import("@/lib/dal/users");
  const u = await getUser(ctx, input.userId);
  if (u?.id) await provider.revokeAllSessions(target.id).catch(() => undefined);
  revalidate();
  return { ok: true };
});

export const reactivateUserAction = action(UserIdSchema, ["user.manage", "contact.manage"], async (ctx, input) => {
  await reactivateUser(ctx, input.userId);
  revalidate();
  return { ok: true };
});

export const setRole = action(SetRoleSchema, "user.manage", async (ctx, input) => {
  await setUserRole(ctx, input.userId, input.roleId);
  revalidate();
  return { ok: true };
});

export const resetUserMfa = action(UserIdSchema, "user.manage", async (ctx, input) => {
  const t = await forceMfaReset(ctx, input.userId);
  const provider = await getAuthProvider();
  if (t.authProviderId) await provider.resetTotp(t.authProviderId).catch(() => undefined);
  revalidate();
  return { ok: true };
});

/** FR-ORG-01 */
export const saveOrg = action(OrgSchema, "org.manage", async (ctx, { id, ...input }) => {
  const row = id ? await updateOrg(ctx, id, input) : await createOrg(ctx, input);
  revalidate();
  return { id: row.id };
});

/** FR-ADM-02 */
export const saveCategory = action(CategorySchema, "admin.categories", async (ctx, { id, ...input }) => {
  const row = id ? await updateCategory(ctx, id, { name: input.name, description: input.description, active: input.active }) : await createCategory(ctx, input);
  revalidate();
  return { id: row.id };
});

export const saveCanned = action(CannedSchema, "canned.manage", async (ctx, input) => {
  const row = await upsertCanned(ctx, input);
  revalidate();
  return { id: row.id };
});

export const removeCanned = action(z.object({ id: uuid }).strict(), "canned.manage", async (ctx, input) => {
  await deleteCanned(ctx, input.id);
  revalidate();
  return { ok: true };
});

/** FR-ADM-03 */
export const saveSlaPolicy = action(SlaPolicySchema, "admin.sla", async (ctx, input) => {
  const row = await upsertPolicy(ctx, input);
  const { audit } = await import("@/lib/dal/audit");
  await audit(ctx, { action: input.id ? "sla_policy.updated" : "sla_policy.created", entityType: "sla_policy", entityId: row.id, after: { name: input.name, targets: input.targets } });
  revalidate();
  return { id: row.id };
});

/** FR-ADM-04 */
export const saveTemplate = action(TemplateSchema, "admin.templates", async (ctx, { id, ...patch }) => {
  await updateTemplate(ctx, id, patch);
  revalidate();
  return { ok: true };
});

/** FR-ADM-05 (developer reply policy, self-assign, time visibility) */
export const saveGlobalSettings = action(GlobalSettingsSchema, "admin.settings", async (ctx, input) => {
  if (Object.keys(input).length === 0) throw new AppError("validation", "Nothing to save.");
  await updateGlobalSettings(ctx, input);
  revalidate();
  return { ok: true };
});

export const saveProfile = action(ProfileSchema, null, async (ctx, input) => {
  await updateProfile(ctx, input);
  revalidatePath("/", "layout");
  return { ok: true };
});

export const saveSavedView = action(SavedViewSchema, "saved_view.manage", async (ctx, input) => {
  const row = await createSavedView(ctx, input);
  revalidate();
  return { id: row.id };
});

export const removeSavedView = action(z.object({ id: uuid }).strict(), "saved_view.manage", async (ctx, input) => {
  await deleteSavedView(ctx, input.id);
  revalidate();
  return { ok: true };
});
