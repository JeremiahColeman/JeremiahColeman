import type { Metadata } from "next";
import { ButtonLink, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Invite link not working" };

export default function InviteInvalidPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Card className="space-y-4 text-center">
        <div aria-hidden className="text-5xl">🔗</div>
        <h1 className="font-display text-2xl font-bold">This invite link isn&apos;t working</h1>
        <p>It may be old. Ask the person who sent it for a new link.</p>
        <ButtonLink href="/shared" className="w-full">
          Go to my lists
        </ButtonLink>
      </Card>
    </main>
  );
}
