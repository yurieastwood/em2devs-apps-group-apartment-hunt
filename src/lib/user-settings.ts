import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userSettings, type UserSettings } from "@/db/schema";

export async function getUserHome(
  clerkUserId: string,
): Promise<UserSettings | null> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.clerkUserId, clerkUserId))
    .limit(1);
  return row ?? null;
}

export async function upsertUserHome(
  clerkUserId: string,
  address: string,
  lat: number,
  lng: number,
): Promise<void> {
  await db
    .insert(userSettings)
    .values({
      clerkUserId,
      homeAddress: address,
      homeLat: lat.toString(),
      homeLng: lng.toString(),
    })
    .onConflictDoUpdate({
      target: userSettings.clerkUserId,
      set: {
        homeAddress: address,
        homeLat: lat.toString(),
        homeLng: lng.toString(),
        updatedAt: new Date(),
      },
    });
}
