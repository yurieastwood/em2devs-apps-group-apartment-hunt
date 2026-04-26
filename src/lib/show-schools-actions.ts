"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SHOW_SCHOOLS_COOKIE } from "./show-schools";

export async function setShowSchoolsAction(enabled: boolean): Promise<void> {
  const c = await cookies();
  if (enabled) {
    c.set(SHOW_SCHOOLS_COOKIE, "true", {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } else {
    c.delete(SHOW_SCHOOLS_COOKIE);
  }
  revalidatePath("/");
}
