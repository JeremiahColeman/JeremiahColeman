import type { Metadata } from "next";
import { InstallCard } from "@/components/install-card";
import { NameForm } from "@/components/name-form";
import { Button, Card, PageTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { user, profile } = await requireProfile("/account");
  return (
    <>
      <PageTitle sub={<>Signed in as <strong className="break-all">{user.email}</strong></>}>Account</PageTitle>
      <div className="space-y-6">
        <Card>
          <NameForm initial={profile.display_name} submitLabel="Save name" />
        </Card>
        <InstallCard />
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="secondary" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </>
  );
}
