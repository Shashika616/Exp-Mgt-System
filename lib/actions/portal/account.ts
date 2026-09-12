"use server";
import { revalidatePath } from "next/cache";
import { action } from "../_helpers";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { getAuthProvider } from "@/lib/auth/provider";
import { deactivateUser, inviteUser } from "@/lib/dal/users";
import { getEmailProvider } from "@/lib/email/provider";
import { renderAuthEmail } from "@/lib/email/render";
import { PortalInviteSchema, UserIdSchema } from "@/lib/schemas/admin";

/** FR-ORG-02 / golden path 4: client_admin invites a colleague into their own org. */
export const inviteColleague = action(PortalInviteSchema, "contact.invite", async (ctx, input) => {
  if (ctx.orgType !== "client") throw new AppError("forbidden");
  const provider = await getAuthProvider();
  const identity = provider.name === "supabase" ? await provider.createIdentity(input.email) : null;
  const { userId, token } = await inviteUser(ctx, { ...input, orgId: ctx.orgId }, { authProviderId: identity?.providerId ?? null });
  const mail = await renderAuthEmail("invitation", { name: input.fullName, url: `${env.APP_URL}/invite/${token}` });
  await getEmailProvider().send({ to: input.email, ...mail, tag: "invitation" });
  revalidatePath("/portal", "layout");
  return { userId };
});

export const deactivateColleague = action(UserIdSchema, "contact.invite", async (ctx, input) => {
  if (ctx.orgType !== "client") throw new AppError("forbidden");
  const target = await deactivateUser(ctx, input.userId);
  const provider = await getAuthProvider();
  await provider.revokeAllSessions(target.id).catch(() => undefined);
  revalidatePath("/portal", "layout");
  return { ok: true };
});
