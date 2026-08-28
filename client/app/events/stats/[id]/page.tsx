import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { StatsPage } from "@/app/events/stats/[id]/stats-client";

export default async function StatsRoute({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <StatsPage eventId={id} isAdmin={isAdmin(session.roles)} />;
}
