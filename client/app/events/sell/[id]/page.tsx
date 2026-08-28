import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { SellPage } from "@/app/events/sell/[id]/sell-client";

export default async function SellRoute({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <SellPage eventId={id} isAdmin={isAdmin(session.roles)} />;
}
