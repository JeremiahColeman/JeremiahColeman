-- Family wishlist: schema, row-level security, triggers, and functions.
--
-- Privacy model (enforced here, not in the UI):
--   1. A list owner sees nothing about claims on their own list.
--   2. Buyers see claim totals for an item, never who claimed it.
--   3. Each person sees only their own claim rows.
--   4. Managed lists (recipient_is_owner = false): the owner is treated like a
--      buyer and sees totals, still never identities.
--   5. Gift reveal is opt-in and only after the event date.
--
-- Helper and trigger functions live in the `private` schema, which PostgREST
-- does not expose, so they cannot be called over the API.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  event_date date,
  -- When event_date was last set. The gift reveal only opens if the date was
  -- set before it arrived, so an owner can't move the date into the past to
  -- peek early.
  event_date_set_at timestamptz,
  recipient_is_owner boolean not null default true,
  recipient_name text check (char_length(recipient_name) <= 80),
  invite_token text unique not null default encode(extensions.gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint managed_list_needs_recipient check (
    recipient_is_owner or nullif(btrim(recipient_name), '') is not null
  )
);
create index lists_owner_id_idx on public.lists (owner_id);

create table public.list_members (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index list_members_user_id_idx on public.list_members (user_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  url text check (url ~* '^https?://'),
  image_url text check (image_url ~* '^https?://'),
  price_cents integer check (price_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  notes text check (char_length(notes) <= 2000),
  priority smallint not null default 2 check (priority in (1, 2, 3)),
  quantity_wanted integer not null default 1 check (quantity_wanted > 0 and quantity_wanted <= 99),
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz
);
create index items_list_id_idx on public.items (list_id);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  claimer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  status text not null check (status in ('reserved', 'purchased')),
  share_name_with_recipient boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, claimer_id)
);
create index claims_claimer_id_idx on public.claims (claimer_id);

-- Totals per item. list_id is denormalized so Realtime can filter by list.
-- Written only by security-definer triggers.
create table public.item_claim_totals (
  item_id uuid primary key references public.items (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  reserved_qty integer not null default 0,
  purchased_qty integer not null default 0,
  updated_at timestamptz not null default now()
);
create index item_claim_totals_list_id_idx on public.item_claim_totals (list_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------

create function private.is_list_owner(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lists l where l.id = p_list_id and l.owner_id = auth.uid()
  );
$$;

create function private.is_list_member(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.list_members m
    where m.list_id = p_list_id and m.user_id = auth.uid()
  );
$$;

-- Members always see totals. The owner sees them only on managed lists.
create function private.can_see_totals(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_list_member(p_list_id)
      or exists (
        select 1 from public.lists l
        where l.id = p_list_id and l.owner_id = auth.uid() and not l.recipient_is_owner
      );
$$;

-- Caller may create or change a claim on this item.
create function private.can_claim_item(p_item_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.items i
    join public.lists l on l.id = i.list_id
    where i.id = p_item_id
      and i.removed_at is null
      and (
        private.is_list_member(l.id)
        or (l.owner_id = auth.uid() and not l.recipient_is_owner)
      )
  );
$$;

-- Caller and p_user_id are on at least one list together.
create function private.shares_list_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    -- caller owns a list p_user_id joined
    select 1 from public.lists l
    join public.list_members m on m.list_id = l.id
    where l.owner_id = auth.uid() and m.user_id = p_user_id
  ) or exists (
    -- p_user_id owns a list the caller joined
    select 1 from public.lists l
    join public.list_members m on m.list_id = l.id
    where l.owner_id = p_user_id and m.user_id = auth.uid()
  ) or exists (
    -- both joined the same list
    select 1 from public.list_members a
    join public.list_members b on b.list_id = a.list_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Create a profile row for every new auth user. The app asks for a display
-- name on first sign-in when this comes back empty.
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      ''
    ), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- lists: owner and recipient_is_owner are fixed after creation. Flipping
-- recipient_is_owner to false would let an owner see totals on their own list.
create function private.lists_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.event_date is not null then
      new.event_date_set_at := now();
    else
      new.event_date_set_at := null;
    end if;
    if new.recipient_is_owner then
      new.recipient_name := null;
    end if;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'A list''s owner can''t be changed.' using errcode = '42501';
  end if;
  if new.recipient_is_owner is distinct from old.recipient_is_owner then
    raise exception 'Who a list is for can''t be changed after it''s created.' using errcode = '42501';
  end if;
  if new.event_date is distinct from old.event_date then
    new.event_date_set_at := case when new.event_date is null then null else now() end;
  else
    new.event_date_set_at := old.event_date_set_at;
  end if;
  return new;
end;
$$;

create trigger lists_guard
  before insert or update on public.lists
  for each row execute function private.lists_guard();

-- list_members: the owner can never be a member of their own list.
create function private.list_members_reject_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.lists l where l.id = new.list_id and l.owner_id = new.user_id) then
    raise exception 'You own this list, so you can''t join it.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger list_members_reject_owner
  before insert or update on public.list_members
  for each row execute function private.list_members_reject_owner();

-- items: list_id is fixed (moving an item to a managed list would expose its
-- totals to the owner). updated_at changes only when content a buyer cares
-- about changes, not on reorder. This trigger is about owner edits only;
-- claim triggers never touch items.
create function private.items_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.list_id is distinct from old.list_id then
    raise exception 'Items can''t be moved to another list.' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  if (new.title, new.url, new.image_url, new.price_cents, new.currency, new.notes, new.quantity_wanted)
     is distinct from
     (old.title, old.url, old.image_url, old.price_cents, old.currency, old.notes, old.quantity_wanted)
  then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger items_guard
  before update on public.items
  for each row execute function private.items_guard();

-- Every item gets a zeroed totals row up front, so claim activity only ever
-- shows up as an UPDATE to an existing row.
create function private.items_create_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.item_claim_totals (item_id, list_id) values (new.id, new.list_id)
  on conflict (item_id) do nothing;
  return new;
end;
$$;

create trigger items_create_totals
  after insert on public.items
  for each row execute function private.items_create_totals();

-- claims, BEFORE: authorize, then prevent overclaiming.
--
-- Authorization is checked here first because BEFORE triggers run before RLS
-- WITH CHECK. Without it, an owner trying to claim on their own list could
-- get the "not enough left" error and learn that others had claimed.
create function private.claims_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_wanted integer;
  v_others integer;
begin
  if auth.uid() is not null then
    if new.claimer_id is distinct from auth.uid() or not private.can_claim_item(new.item_id) then
      raise exception 'You can''t claim this item.' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.item_id is distinct from old.item_id or new.claimer_id is distinct from old.claimer_id then
      raise exception 'A claim can''t be moved.' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  -- Lowering a quantity, or changing only status or the share toggle, is
  -- always allowed, even if the owner has since lowered quantity_wanted.
  if tg_op = 'UPDATE' and new.quantity <= old.quantity then
    return new;
  end if;

  -- Lock the item row so concurrent claims on the same item run one at a time.
  -- FOR UPDATE takes a row lock only; it does not modify the item.
  select i.quantity_wanted into v_wanted
  from public.items i
  where i.id = new.item_id
  for update;

  select coalesce(sum(c.quantity), 0) into v_others
  from public.claims c
  where c.item_id = new.item_id and c.id <> new.id;

  if v_others + new.quantity > v_wanted then
    raise exception 'Only % left to claim.', greatest(v_wanted - v_others, 0)
      using errcode = 'P0001', hint = 'overclaim';
  end if;

  return new;
end;
$$;

create trigger claims_before_write
  before insert or update on public.claims
  for each row execute function private.claims_before_write();

-- claims, AFTER: recompute totals for the affected item. Writes only to
-- item_claim_totals, never to items.
create function private.claims_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_item_id uuid := coalesce(new.item_id, old.item_id);
begin
  update public.item_claim_totals t
  set reserved_qty = coalesce((
        select sum(c.quantity) from public.claims c
        where c.item_id = v_item_id and c.status = 'reserved'), 0),
      purchased_qty = coalesce((
        select sum(c.quantity) from public.claims c
        where c.item_id = v_item_id and c.status = 'purchased'), 0),
      updated_at = now()
  where t.item_id = v_item_id;
  return null;
end;
$$;

create trigger claims_after_write
  after insert or update or delete on public.claims
  for each row execute function private.claims_after_write();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.items enable row level security;
alter table public.claims enable row level security;
alter table public.item_claim_totals enable row level security;

-- Nothing is readable or writable while signed out.
revoke all on all tables in schema public from anon;

-- profiles
create policy "profiles: read self and people you share a list with"
  on public.profiles for select to authenticated
  using (id = auth.uid() or private.shares_list_with(id));
create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, delete on public.profiles from authenticated;

-- lists
create policy "lists: read as owner or member"
  on public.lists for select to authenticated
  using (owner_id = auth.uid() or private.is_list_member(id));
create policy "lists: insert as yourself"
  on public.lists for insert to authenticated
  with check (owner_id = auth.uid());
create policy "lists: owner updates"
  on public.lists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "lists: owner deletes"
  on public.lists for delete to authenticated
  using (owner_id = auth.uid());

-- list_members (inserts only through join_list())
create policy "list_members: read as owner or member"
  on public.list_members for select to authenticated
  using (private.is_list_owner(list_id) or private.is_list_member(list_id));
create policy "list_members: leave, or owner removes"
  on public.list_members for delete to authenticated
  using (user_id = auth.uid() or private.is_list_owner(list_id));
revoke insert, update on public.list_members from authenticated;

-- items
-- Members see live items. The owner also sees their removed items so the
-- soft delete (an UPDATE) can be read back and undone.
create policy "items: read as owner or member"
  on public.items for select to authenticated
  using (
    private.is_list_owner(list_id)
    or (removed_at is null and private.is_list_member(list_id))
  );
create policy "items: owner inserts"
  on public.items for insert to authenticated
  with check (private.is_list_owner(list_id));
create policy "items: owner updates"
  on public.items for update to authenticated
  using (private.is_list_owner(list_id)) with check (private.is_list_owner(list_id));
-- No DELETE: items are soft-deleted. A hard delete could fail on existing
-- claims and reveal them to the owner.
revoke delete on public.items from authenticated;

-- claims
create policy "claims: read your own"
  on public.claims for select to authenticated
  using (claimer_id = auth.uid());
create policy "claims: create your own"
  on public.claims for insert to authenticated
  with check (claimer_id = auth.uid() and private.can_claim_item(item_id));
create policy "claims: update your own"
  on public.claims for update to authenticated
  using (claimer_id = auth.uid())
  with check (claimer_id = auth.uid() and private.can_claim_item(item_id));
create policy "claims: delete your own"
  on public.claims for delete to authenticated
  using (claimer_id = auth.uid());

-- item_claim_totals: read-only
create policy "item_claim_totals: members, or owner of a managed list"
  on public.item_claim_totals for select to authenticated
  using (private.can_see_totals(list_id));
revoke insert, update, delete, truncate on public.item_claim_totals from authenticated;

revoke truncate, references, trigger on all tables in schema public from authenticated;

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------

create function public.join_list(p_invite_token text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_list public.lists%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select * into v_list from public.lists where invite_token = p_invite_token;
  if not found then
    raise exception 'This invite link isn''t valid anymore. Ask for a new one.' using errcode = 'P0002';
  end if;
  if v_list.owner_id = auth.uid() then
    raise exception 'This is your own list, so you can''t join it.' using errcode = '42501';
  end if;
  insert into public.list_members (list_id, user_id) values (v_list.id, auth.uid())
  on conflict do nothing;
  return v_list.id;
end;
$$;

create function public.rotate_invite_token(p_list_id uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(18), 'hex');
begin
  update public.lists set invite_token = v_token
  where id = p_list_id and owner_id = auth.uid();
  if not found then
    raise exception 'Only the list owner can do that.' using errcode = '42501';
  end if;
  return v_token;
end;
$$;

-- The caller's own claims across every list, including items the owner later
-- removed or edited.
create function public.my_shopping()
returns table (
  claim_id uuid,
  item_id uuid,
  list_id uuid,
  list_title text,
  recipient_name text,
  event_date date,
  item_title text,
  url text,
  image_url text,
  price_cents integer,
  currency text,
  notes text,
  quantity_wanted integer,
  quantity integer,
  status text,
  share_name_with_recipient boolean,
  claimed_at timestamptz,
  item_removed boolean,
  item_edited boolean
)
language sql stable security definer set search_path = '' as $$
  select
    c.id, i.id, l.id, l.title,
    case when l.recipient_is_owner then p.display_name else l.recipient_name end,
    l.event_date,
    i.title, i.url, i.image_url, i.price_cents, i.currency, i.notes, i.quantity_wanted,
    c.quantity, c.status, c.share_name_with_recipient, c.created_at,
    i.removed_at is not null,
    i.updated_at > c.created_at
  from public.claims c
  join public.items i on i.id = c.item_id
  join public.lists l on l.id = i.list_id
  join public.profiles p on p.id = l.owner_id
  where c.claimer_id = auth.uid()
  order by l.event_date nulls last, l.title, i.sort_order nulls last, i.created_at;
$$;

-- Owner only, own-recipient lists only, after the event date (and only when
-- that date was set before it arrived). Names appear only for opted-in givers.
create function public.get_gift_reveal(p_list_id uuid)
returns table (
  item_id uuid,
  title text,
  url text,
  image_url text,
  price_cents integer,
  currency text,
  purchased_qty integer,
  givers text[]
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_list public.lists%rowtype;
  v_today date := (now() at time zone 'utc')::date;
begin
  select * into v_list from public.lists where id = p_list_id and owner_id = auth.uid();
  if not found
     or not v_list.recipient_is_owner
     or v_list.event_date is null
     or v_today <= v_list.event_date
     or v_list.event_date_set_at is null
     or (v_list.event_date_set_at at time zone 'utc')::date > v_list.event_date
  then
    raise exception 'The gift reveal opens the day after the event date.' using errcode = '42501';
  end if;

  return query
  select
    i.id, i.title, i.url, i.image_url, i.price_cents, i.currency,
    sum(c.quantity)::integer,
    coalesce(
      array_agg(distinct p.display_name order by p.display_name)
        filter (where c.share_name_with_recipient and p.display_name <> ''),
      '{}'
    )
  from public.items i
  join public.claims c on c.item_id = i.id and c.status = 'purchased'
  join public.profiles p on p.id = c.claimer_id
  where i.list_id = p_list_id
  group by i.id
  order by i.sort_order nulls last, i.created_at;
end;
$$;

revoke all on function public.join_list(text) from public, anon;
revoke all on function public.rotate_invite_token(uuid) from public, anon;
revoke all on function public.my_shopping() from public, anon;
revoke all on function public.get_gift_reveal(uuid) from public, anon;
grant execute on function public.join_list(text) to authenticated;
grant execute on function public.rotate_invite_token(uuid) to authenticated;
grant execute on function public.my_shopping() to authenticated;
grant execute on function public.get_gift_reveal(uuid) to authenticated;

-- Keep future objects closed to anon by default.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;

-- ---------------------------------------------------------------------------
-- Realtime: items and totals only. claims is never published.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.items, public.item_claim_totals;
