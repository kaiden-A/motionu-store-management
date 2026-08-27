import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { EventsPage } from "@/app/events/events-client";

export default async function EventsRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <EventsPage isAdmin={isAdmin(session.roles)} />;
}
