/**
 * Privacy and integrity tests for the wishlist database, run against the local
 * Supabase stack through the same REST and Realtime APIs the app uses.
 *
 * Users: A owns the lists, B and C are buyers, D is an outsider.
 */
import { randomUUID } from "node:crypto";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addItem,
  anonClient,
  anonKey,
  claim,
  createList,
  createUser,
  isoDate,
  join,
  must,
  sleep,
  url,
  withDb,
  type TestUser,
} from "./helpers";

let A: TestUser, B: TestUser, C: TestUser, D: TestUser;

// A's own list (A is the recipient)
let own: { id: string; invite_token: string };
let ownItems: { big: { id: string; updated_at: string }; single: { id: string; updated_at: string }; untouched: { id: string } };
// A managed list A made for someone without an account
let managed: { id: string; invite_token: string };
let managedItem: { id: string };

const claimIds: string[] = [];

beforeAll(async () => {
  [A, B, C, D] = await Promise.all([createUser("Alice"), createUser("Bob"), createUser("Cara"), createUser("Dan")]);

  own = await createList(A, { title: "Alice's Christmas", event_date: isoDate(30) });
  ownItems = {
    big: await addItem(A, own.id, "Wool socks", 3),
    single: await addItem(A, own.id, "Board game", 1),
    untouched: await addItem(A, own.id, "Cookbook", 1),
  };
  await join(B, own.invite_token);
  await join(C, own.invite_token);

  claimIds.push(must(await claim(B, ownItems.big.id, 2, "reserved", true)).id);
  claimIds.push(must(await claim(C, ownItems.big.id, 1, "purchased")).id);
  claimIds.push(must(await claim(B, ownItems.single.id, 1, "purchased", true)).id);

  managed = await createList(A, { title: "Rex's stocking", recipient_is_owner: false, recipient_name: "Rex the dog" });
  managedItem = await addItem(A, managed.id, "Squeaky toy", 2);
  await join(B, managed.invite_token);
  claimIds.push(must(await claim(B, managedItem.id, 1, "reserved", true)).id);
});

/** True if a value contains anything that ties a claim to a person. */
function leaksClaims(value: unknown, people: TestUser[]) {
  const text = JSON.stringify(value ?? null);
  return claimIds.some((id) => text.includes(id)) || people.some((p) => text.includes(p.id));
}

async function openApi(user: TestUser) {
  const res = await fetch(`${url()}/rest/v1/`, {
    headers: { apikey: anonKey(), Authorization: `Bearer ${user.token}`, Accept: "application/openapi+json" },
  });
  expect(res.ok).toBe(true);
  return (await res.json()) as { paths: Record<string, unknown> };
}

const EXPOSED_TABLES = ["claims", "item_claim_totals", "items", "list_members", "lists", "profiles"];
const EXPOSED_FUNCTIONS = ["get_gift_reveal", "join_list", "my_shopping", "rotate_invite_token"];

describe("API surface", () => {
  it("exposes exactly the expected tables and functions, and no views", async () => {
    const paths = Object.keys((await openApi(A)).paths).filter((p) => p !== "/");
    const tables = paths.filter((p) => !p.startsWith("/rpc/")).map((p) => p.slice(1)).sort();
    const fns = paths.filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)).sort();
    expect(tables).toEqual(EXPOSED_TABLES);
    expect(fns).toEqual(EXPOSED_FUNCTIONS);
  });

  it("does not expose the private helper schema", async () => {
    const res = await fetch(`${url()}/rest/v1/rpc/can_see_totals`, {
      method: "POST",
      headers: {
        apikey: anonKey(),
        Authorization: `Bearer ${A.token}`,
        "Content-Profile": "private",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_list_id: own.id }),
    });
    expect(res.ok).toBe(false);
  });

  it("GraphQL is not enabled", async () => {
    const res = await fetch(`${url()}/graphql/v1`, {
      method: "POST",
      headers: { apikey: anonKey(), Authorization: `Bearer ${C.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ claimsCollection { edges { node { claimer_id } } } }" }),
    });
    const body = await res.json();
    expect(leaksClaims(body, [B])).toBe(false);
  });

  it("signed-out visitors can read nothing", async () => {
    const anon = anonClient();
    for (const table of EXPOSED_TABLES) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? []).toEqual([]);
    }
    for (const fn of EXPOSED_FUNCTIONS) {
      const { error } = await anon.rpc(fn, {});
      expect(error).not.toBeNull();
    }
  });
});

describe("1. Owner reads claims and totals on their own list", () => {
  it("gets zero rows from claims and item_claim_totals", async () => {
    const claims = must(await A.client.from("claims").select("*"));
    expect(claims).toEqual([]);
    const totals = must(await A.client.from("item_claim_totals").select("*").eq("list_id", own.id));
    expect(totals).toEqual([]);
    const allTotals = must(await A.client.from("item_claim_totals").select("*"));
    expect(allTotals.every((t: { list_id: string }) => t.list_id !== own.id)).toBe(true);
  });

  it("claims never change items.updated_at", async () => {
    const items = must(
      await A.client.from("items").select("id, updated_at").in("id", [ownItems.big.id, ownItems.single.id]),
    ) as { id: string; updated_at: string }[];
    const byId = Object.fromEntries(items.map((i) => [i.id, i.updated_at]));
    expect(byId[ownItems.big.id]).toBe(ownItems.big.updated_at);
    expect(byId[ownItems.single.id]).toBe(ownItems.single.updated_at);
  });

  it("nothing the owner can read on their list or items mentions a claim", async () => {
    const reads = await Promise.all([
      A.client.from("lists").select("*").eq("id", own.id),
      A.client.from("items").select("*").eq("list_id", own.id),
      A.client.from("list_members").select("*").eq("list_id", own.id),
    ]);
    for (const r of reads) expect(leaksClaims(must(r), [])).toBe(false);
  });
});

describe("2. Owner calls every function before the event date", () => {
  it("covers every exposed function and none returns claim information", async () => {
    // If a new function is added, this test must be extended to cover it.
    expect(EXPOSED_FUNCTIONS).toEqual(["get_gift_reveal", "join_list", "my_shopping", "rotate_invite_token"]);

    const reveal = await A.client.rpc("get_gift_reveal", { p_list_id: own.id });
    expect(reveal.data).toBeNull();
    expect(reveal.error?.message).toMatch(/opens the day after the event date/);

    // Same answer on a list with no claims at all, so the error is not an oracle.
    const empty = await createList(A, { title: "Empty list", event_date: isoDate(30) });
    const emptyReveal = await A.client.rpc("get_gift_reveal", { p_list_id: empty.id });
    expect(emptyReveal.error?.message).toBe(reveal.error?.message);
    expect(emptyReveal.error?.code).toBe(reveal.error?.code);

    const joined = await A.client.rpc("join_list", { p_invite_token: own.invite_token });
    expect(joined.data).toBeNull();
    expect(joined.error).not.toBeNull();

    const shopping = must(await A.client.rpc("my_shopping"));
    expect(shopping).toEqual([]);

    const token = must(await A.client.rpc("rotate_invite_token", { p_list_id: empty.id }));
    expect(token).toMatch(/^[0-9a-f]{36}$/);

    for (const r of [reveal, emptyReveal, joined, shopping, token]) {
      expect(leaksClaims(r, [B, C])).toBe(false);
    }
  });

  it("an owner claiming on their own list gets the same refusal whether or not others claimed", async () => {
    // big is fully claimed (3 of 3); untouched has no claims.
    const onFull = await claim(A, ownItems.big.id, 3);
    const onEmpty = await claim(A, ownItems.untouched.id, 1);
    expect(onFull.error?.code).toBe("42501");
    expect(onFull.error?.message).toBe(onEmpty.error?.message);
    expect(onFull.error?.code).toBe(onEmpty.error?.code);
    expect(onFull.error?.message).not.toMatch(/left/);
  });

  it("an owner can't switch their list to a managed list to see totals", async () => {
    const res = await A.client.from("lists").update({ recipient_is_owner: false, recipient_name: "x" }).eq("id", own.id);
    expect(res.error?.code).toBe("42501");
  });

  it("an owner can't move an item to a managed list to see its totals", async () => {
    const res = await A.client.from("items").update({ list_id: managed.id }).eq("id", ownItems.big.id);
    expect(res.error?.code).toBe("42501");
  });

  it("an owner can't hard-delete an item (which could fail on claims and reveal them)", async () => {
    const res = await A.client.from("items").delete().eq("id", ownItems.big.id);
    expect(res.error).not.toBeNull();
    expect(res.error?.message).not.toMatch(/claim/i);
  });
});

describe("3. Realtime on the owner's own list", () => {
  const channels: RealtimeChannel[] = [];

  // Realtime restarts with `supabase db reset` and refuses connections for a
  // few seconds. Wait until a throwaway subscription attaches to Postgres.
  beforeAll(async () => {
    const deadline = Date.now() + 60_000;
    for (;;) {
      const probe = await createUser("Probe");
      const ok = await new Promise<boolean>((resolve) => {
        const ch = probe.client
          .channel(`probe-${randomUUID()}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => {})
          .on("system", {}, (p: { extension?: string; status?: string }) => {
            if (p.extension === "postgres_changes" && p.status === "ok") resolve(true);
          });
        ch.subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve(false);
        });
        setTimeout(() => resolve(false), 10_000);
      });
      await probe.client.removeAllChannels();
      if (ok) return;
      if (Date.now() > deadline) throw new Error("Realtime did not become ready");
      await sleep(1000);
    }
  }, 90_000);

  afterAll(async () => {
    await Promise.all(channels.map((c) => c.unsubscribe()));
  });

  async function watch(user: TestUser, listId: string, tables: string[]) {
    const events: { table: string; eventType: string; new: Record<string, unknown> }[] = [];
    let ch = user.client.channel(`watch-${randomUUID()}`);
    for (const table of tables) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `list_id=eq.${listId}` },
        (p) => events.push({ table: p.table, eventType: p.eventType, new: p.new as Record<string, unknown> }),
      );
    }
    // Wait until Realtime confirms it is attached to Postgres, not just joined.
    await new Promise<void>((resolve, reject) => {
      ch = ch.on("system", {}, (p: { extension?: string; status?: string }) => {
        if (p.extension === "postgres_changes" && p.status === "ok") resolve();
      });
      ch.subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(err ?? new Error(status));
      });
    });
    channels.push(ch);
    return events;
  }

  async function waitFor(check: () => boolean, ms = 15_000) {
    const start = Date.now();
    while (!check()) {
      if (Date.now() - start > ms) throw new Error("timed out waiting for realtime event");
      await sleep(100);
    }
  }

  it("the owner receives item events but no claim events; buyers receive totals", async () => {
    const item = await addItem(A, own.id, "Scarf", 2);
    const ownerEvents = await watch(A, own.id, ["items", "item_claim_totals"]);
    const buyerEvents = await watch(C, own.id, ["items", "item_claim_totals"]);

    // Positive control: the owner's channel works.
    must(await A.client.from("items").update({ notes: "Blue, please" }).eq("id", item.id));
    await waitFor(() => ownerEvents.some((e) => e.table === "items" && e.eventType === "UPDATE" && e.new.id === item.id));

    // B reserves and then purchases.
    const c = must(await claim(B, item.id, 1));
    must(await B.client.from("claims").update({ status: "purchased" }).eq("id", c.id));
    await waitFor(() => buyerEvents.filter((e) => e.table === "item_claim_totals").length >= 2);
    const last = buyerEvents.filter((e) => e.table === "item_claim_totals").at(-1)!;
    expect(last.new).toMatchObject({ item_id: item.id, purchased_qty: 1, reserved_qty: 0 });
    expect(Object.keys(last.new).sort()).toEqual(["item_id", "list_id", "purchased_qty", "reserved_qty", "updated_at"]);

    await sleep(2500); // give any stray event time to arrive
    expect(ownerEvents.filter((e) => e.table === "item_claim_totals")).toEqual([]);
    // Claims never touch items, so the owner saw no item change beyond their own edit.
    expect(ownerEvents.filter((e) => e.table === "items" && e.eventType === "UPDATE")).toHaveLength(1);
    expect(leaksClaims(buyerEvents, [B])).toBe(false);
  });

  it("the claims table is not published to Realtime at all", async () => {
    const tables = await withDb(async (db) =>
      (await db.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1")).rows.map(
        (r) => r.tablename,
      ),
    );
    expect(tables).toEqual(["item_claim_totals", "items"]);
  });

  it("on a managed list, the owner does receive totals events", async () => {
    const ownerEvents = await watch(A, managed.id, ["item_claim_totals"]);
    const item = await addItem(A, managed.id, "Chew bone", 1);
    must(await claim(B, item.id, 1));
    await waitFor(() => ownerEvents.some((e) => e.new.item_id === item.id && e.new.reserved_qty === 1));
    expect(leaksClaims(ownerEvents, [B])).toBe(false);
  });
});

describe("4. A buyer reads totals and claims", () => {
  it("C sees counts for A's list", async () => {
    const totals = must(await C.client.from("item_claim_totals").select("*").eq("list_id", own.id)) as {
      item_id: string;
      reserved_qty: number;
      purchased_qty: number;
    }[];
    const big = totals.find((t) => t.item_id === ownItems.big.id)!;
    expect(big).toMatchObject({ reserved_qty: 2, purchased_qty: 1 });
    const single = totals.find((t) => t.item_id === ownItems.single.id)!;
    expect(single).toMatchObject({ reserved_qty: 0, purchased_qty: 1 });
  });

  it("C sees only C's own claims, never B's", async () => {
    const claims = must(await C.client.from("claims").select("*")) as { claimer_id: string }[];
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.every((c) => c.claimer_id === C.id)).toBe(true);
    const targeted = must(await C.client.from("claims").select("*").eq("claimer_id", B.id));
    expect(targeted).toEqual([]);
  });
});

describe("5. C can't learn B's identity as a claimer", () => {
  it("no table, function, or filter links B to a claim", async () => {
    const reads: unknown[] = [];
    for (const table of EXPOSED_TABLES) reads.push(must(await C.client.from(table).select("*")));

    // Filtering and counting tricks on claims return nothing about B.
    reads.push(must(await C.client.from("claims").select("*").eq("item_id", ownItems.big.id).neq("claimer_id", C.id)));
    const counted = await C.client.from("claims").select("*", { count: "exact", head: true }).eq("claimer_id", B.id);
    expect(counted.count).toBe(0);

    reads.push(must(await C.client.rpc("my_shopping")));
    const reveal = await C.client.rpc("get_gift_reveal", { p_list_id: own.id });
    expect(reveal.error).not.toBeNull();
    reads.push(reveal);

    // Profiles may include B (they share a list), but never with claim data.
    const profiles = reads[EXPOSED_TABLES.indexOf("profiles")] as Record<string, unknown>[];
    for (const p of profiles) expect(Object.keys(p).sort()).toEqual(["created_at", "display_name", "id"]);

    const totals = reads[EXPOSED_TABLES.indexOf("item_claim_totals")] as Record<string, unknown>[];
    for (const t of totals) {
      expect(Object.keys(t).sort()).toEqual(["item_id", "list_id", "purchased_qty", "reserved_qty", "updated_at"]);
    }

    // No B claim id appears anywhere C can read.
    const bClaimIds = claimIds.filter((_, i) => i !== 1); // index 1 is C's claim
    const text = JSON.stringify(reads);
    for (const id of bClaimIds) expect(text).not.toContain(id);

    const claims = reads[EXPOSED_TABLES.indexOf("claims")] as { claimer_id: string }[];
    expect(claims.every((c) => c.claimer_id === C.id)).toBe(true);
  });

  it("C can't change or delete B's claim", async () => {
    const upd = await C.client.from("claims").update({ quantity: 1 }).eq("id", claimIds[0]).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await C.client.from("claims").delete().eq("id", claimIds[0]).select();
    expect(del.data ?? []).toEqual([]);
    const still = must(await B.client.from("claims").select("quantity").eq("id", claimIds[0]).single()) as {
      quantity: number;
    };
    expect(still.quantity).toBe(2);
  });
});

describe("6. Overclaiming", () => {
  it("B can't claim more than is wanted, or raise a claim past it", async () => {
    const item = await addItem(A, own.id, "Mug", 2);
    const tooMany = await claim(B, item.id, 3);
    expect(tooMany.error?.message).toMatch(/Only 2 left/);

    const ok = must(await claim(B, item.id, 1));
    must(await claim(C, item.id, 1));
    const raise = await B.client.from("claims").update({ quantity: 2 }).eq("id", ok.id);
    expect(raise.error?.message).toMatch(/Only 1 left/);
  });

  it("two buyers claiming in parallel never exceed the wanted quantity", async () => {
    for (let round = 0; round < 8; round++) {
      const item = await addItem(A, own.id, `Race item ${round}`, 2);
      const results = await Promise.all([claim(B, item.id, 2), claim(C, item.id, 2)]);
      expect(results.filter((r) => !r.error)).toHaveLength(1);
      const totals = must(await C.client.from("item_claim_totals").select("*").eq("item_id", item.id).single()) as {
        reserved_qty: number;
      };
      expect(totals.reserved_qty).toBe(2);
    }
  });

  it("B sending two claims for the same item in parallel creates only one", async () => {
    const item = await addItem(A, own.id, "Double-tap", 5);
    const results = await Promise.all([claim(B, item.id, 1), claim(B, item.id, 1)]);
    expect(results.filter((r) => !r.error)).toHaveLength(1);
  });

  it("the item lock makes a second transaction wait, then reject (deterministic)", async () => {
    const item = await addItem(A, own.id, "Locked item", 2);
    const asUser = (id: string) =>
      `select set_config('role', 'authenticated', true), set_config('request.jwt.claims', '${JSON.stringify({ sub: id, role: "authenticated" })}', true)`;

    await withDb(async (db1) =>
      withDb(async (db2) => {
        await db1.query("begin");
        await db1.query(asUser(B.id));
        await db1.query("insert into public.claims (item_id, claimer_id, quantity, status) values ($1, $2, 2, 'reserved')", [
          item.id,
          B.id,
        ]);

        await db2.query("begin");
        await db2.query(asUser(C.id));
        let settled = false;
        const second = db2
          .query("insert into public.claims (item_id, claimer_id, quantity, status) values ($1, $2, 2, 'reserved')", [
            item.id,
            C.id,
          ])
          .finally(() => (settled = true));
        second.catch(() => {});

        await sleep(750);
        expect(settled).toBe(false); // blocked on the item row lock

        await db1.query("commit");
        await expect(second).rejects.toThrow(/Only 0 left/);
        await db2.query("rollback");
      }),
    );
  });
});

describe("7. A non-member", () => {
  it("can't read the list, its items, members, or totals", async () => {
    expect(must(await D.client.from("lists").select("*").eq("id", own.id))).toEqual([]);
    expect(must(await D.client.from("items").select("*").eq("list_id", own.id))).toEqual([]);
    expect(must(await D.client.from("list_members").select("*").eq("list_id", own.id))).toEqual([]);
    expect(must(await D.client.from("item_claim_totals").select("*").eq("list_id", own.id))).toEqual([]);
    expect(must(await D.client.from("profiles").select("*").eq("id", A.id))).toEqual([]);
  });

  it("can't claim, write items, or add themselves as a member directly", async () => {
    expect((await claim(D, ownItems.untouched.id)).error).not.toBeNull();
    expect((await D.client.from("items").insert({ list_id: own.id, title: "Sneaky" })).error).not.toBeNull();
    expect((await D.client.from("list_members").insert({ list_id: own.id, user_id: D.id })).error).not.toBeNull();
  });
});

describe("8. Owner and the invite link", () => {
  it("A can't join A's own list", async () => {
    const res = await A.client.rpc("join_list", { p_invite_token: own.invite_token });
    expect(res.error?.message).toMatch(/your own list/);
    const members = must(await A.client.from("list_members").select("user_id").eq("list_id", own.id)) as {
      user_id: string;
    }[];
    expect(members.map((m) => m.user_id)).not.toContain(A.id);
  });

  it("rotating the token invalidates the old link", async () => {
    const list = await createList(A, { title: "Rotating" });
    const fresh = must(await A.client.rpc("rotate_invite_token", { p_list_id: list.id })) as string;
    expect((await D.client.rpc("join_list", { p_invite_token: list.invite_token })).error).not.toBeNull();
    expect(must(await D.client.rpc("join_list", { p_invite_token: fresh }))).toBe(list.id);
    expect((await B.client.rpc("rotate_invite_token", { p_list_id: list.id })).error).not.toBeNull();
  });
});

describe("9. Managed list (recipient_is_owner = false)", () => {
  it("A sees totals but no claimer identities", async () => {
    const totals = must(await A.client.from("item_claim_totals").select("*").eq("item_id", managedItem.id).single());
    expect(totals).toMatchObject({ reserved_qty: 1, purchased_qty: 0 });
    expect(must(await A.client.from("claims").select("*"))).toEqual([]);
    expect(leaksClaims(totals, [B])).toBe(false);
  });

  it("A can claim on it like a buyer and sees only their own claim", async () => {
    must(await claim(A, managedItem.id, 1, "reserved"));
    const mine = must(await A.client.from("claims").select("*")) as { claimer_id: string }[];
    expect(mine).toHaveLength(1);
    expect(mine[0].claimer_id).toBe(A.id);
    const shopping = must(await A.client.rpc("my_shopping")) as { recipient_name: string }[];
    expect(shopping.map((s) => s.recipient_name)).toEqual(["Rex the dog"]);
  });

  it("the gift reveal isn't available on managed lists", async () => {
    expect((await A.client.rpc("get_gift_reveal", { p_list_id: managed.id })).error).not.toBeNull();
  });
});

describe("10. Gift reveal", () => {
  it("works only after the event date and names only opted-in givers", async () => {
    const list = await createList(A, { title: "Birthday", event_date: isoDate(10) });
    const shared = await addItem(A, list.id, "Headphones");
    const anonymous = await addItem(A, list.id, "Candle", 2);
    const reservedOnly = await addItem(A, list.id, "Puzzle");
    await join(B, list.invite_token);
    await join(C, list.invite_token);
    must(await claim(B, shared.id, 1, "purchased", true));
    must(await claim(C, anonymous.id, 1, "purchased", false));
    must(await claim(B, anonymous.id, 1, "purchased", false));
    must(await claim(C, reservedOnly.id, 1, "reserved", true));

    expect((await A.client.rpc("get_gift_reveal", { p_list_id: list.id })).error).not.toBeNull();

    // Moving the date into the past doesn't open the reveal early.
    must(await A.client.from("lists").update({ event_date: isoDate(-1) }).eq("id", list.id));
    expect((await A.client.rpc("get_gift_reveal", { p_list_id: list.id })).error).not.toBeNull();

    // Simulate time passing: the date was set 20 days ago for yesterday.
    await withDb((db) =>
      db.query(
        `begin;
         set local session_replication_role = replica;
         update public.lists set event_date = current_date - 1, event_date_set_at = now() - interval '20 days' where id = '${list.id}';
         commit;`,
      ),
    );

    const reveal = must(await A.client.rpc("get_gift_reveal", { p_list_id: list.id })) as {
      item_id: string;
      purchased_qty: number;
      givers: string[];
    }[];
    expect(reveal.map((r) => r.item_id).sort()).toEqual([shared.id, anonymous.id].sort());
    expect(reveal.find((r) => r.item_id === shared.id)).toMatchObject({ purchased_qty: 1, givers: ["Bob"] });
    expect(reveal.find((r) => r.item_id === anonymous.id)).toMatchObject({ purchased_qty: 2, givers: [] });
    expect(JSON.stringify(reveal)).not.toContain("Cara");
    expect(leaksClaims(reveal, [B, C])).toBe(false);

    // Buyers can't open someone else's reveal.
    expect((await B.client.rpc("get_gift_reveal", { p_list_id: list.id })).error).not.toBeNull();
  });
});

describe("My shopping flags", () => {
  it("flags items edited or removed after the claim, but not reorders", async () => {
    const list = await createList(A, { title: "Flags" });
    const edited = await addItem(A, list.id, "Lamp");
    const removed = await addItem(A, list.id, "Vase");
    const reordered = await addItem(A, list.id, "Pen");
    await join(B, list.invite_token);
    for (const i of [edited, removed, reordered]) must(await claim(B, i.id));
    await sleep(20);

    must(await A.client.from("items").update({ price_cents: 4999 }).eq("id", edited.id));
    must(await A.client.from("items").update({ removed_at: new Date().toISOString() }).eq("id", removed.id));
    must(await A.client.from("items").update({ sort_order: 7, priority: 1 }).eq("id", reordered.id));

    // B can no longer see the removed item directly…
    expect(must(await B.client.from("items").select("id").eq("id", removed.id))).toEqual([]);

    // …but My shopping still lists it, flagged.
    const rows = must(await B.client.rpc("my_shopping")) as {
      item_id: string;
      item_edited: boolean;
      item_removed: boolean;
    }[];
    const byId = Object.fromEntries(rows.map((r) => [r.item_id, r]));
    expect(byId[edited.id]).toMatchObject({ item_edited: true, item_removed: false });
    expect(byId[removed.id]).toMatchObject({ item_removed: true });
    expect(byId[reordered.id]).toMatchObject({ item_edited: false, item_removed: false });
  });
});
