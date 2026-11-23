import type { Metadata } from "next";
import { Card, PageTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "My shopping" };

export default async function ShoppingPage() {
  await requireProfile("/shopping");
  return (
    <>
      <PageTitle sub="Everything you've reserved or bought, in one place.">My shopping</PageTitle>
      <Card>
        <p className="text-muted">Gifts you reserve will appear here.</p>
      </Card>
    </>
  );
}
