"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { VIEW_MODE_COOKIE, type ViewMode } from "./view-mode";

export async function setViewModeAction(mode: ViewMode): Promise<void> {
  const c = await cookies();
  c.set(VIEW_MODE_COOKIE, mode, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  revalidatePath("/");
}
