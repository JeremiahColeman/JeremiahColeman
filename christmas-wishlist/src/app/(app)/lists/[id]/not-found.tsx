import { ButtonLink, Card } from "@/components/ui";

export default function ListNotFound() {
  return (
    <Card className="space-y-4 text-center">
      <div aria-hidden className="text-5xl">🎄</div>
      <h1 className="font-display text-2xl font-bold">This list isn&apos;t available</h1>
      <p>It may have been deleted, or you may need a new invite link from the person who made it.</p>
      <ButtonLink href="/shared" className="w-full">
        See lists shared with me
      </ButtonLink>
    </Card>
  );
}
