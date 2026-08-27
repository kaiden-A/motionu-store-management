import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PreOrdersPage } from "@/app/preorders/preorders-client";

export default async function PreOrdersRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <PreOrdersPage />;
}
