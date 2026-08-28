import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { SettingsPage } from "@/app/settings/settings-client";

export default async function SettingsRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.roles)) redirect("/events");
  return <SettingsPage />;
}
