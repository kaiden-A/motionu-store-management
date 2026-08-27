import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { SetupPage } from "@/app/events/[id]/setup/setup-client";

export default async function SetupRoute({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <SetupPage eventId={id} isAdmin={isAdmin(session.roles)} />;
}
