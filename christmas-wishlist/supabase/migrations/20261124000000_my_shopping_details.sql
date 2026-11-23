-- my_shopping(): also return whether the list's recipient is its owner (the
-- "share my name" toggle only matters there, since only those lists have a
-- gift reveal) and whether the caller can still change the claim (not if the
-- item was removed or they left the list). Still the caller's own claims only.

drop function public.my_shopping();

create function public.my_shopping()
returns table (
  claim_id uuid,
  item_id uuid,
  list_id uuid,
  list_title text,
  recipient_name text,
  recipient_is_owner boolean,
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
  item_edited boolean,
  can_change boolean
)
language sql stable security definer set search_path = '' as $$
  select
    c.id, i.id, l.id, l.title,
    case when l.recipient_is_owner then p.display_name else l.recipient_name end,
    l.recipient_is_owner,
    l.event_date,
    i.title, i.url, i.image_url, i.price_cents, i.currency, i.notes, i.quantity_wanted,
    c.quantity, c.status, c.share_name_with_recipient, c.created_at,
    i.removed_at is not null,
    i.updated_at > c.created_at,
    private.can_claim_item(i.id)
  from public.claims c
  join public.items i on i.id = c.item_id
  join public.lists l on l.id = i.list_id
  join public.profiles p on p.id = l.owner_id
  where c.claimer_id = auth.uid()
  order by l.event_date nulls last, l.title, i.sort_order nulls last, i.created_at;
$$;

revoke all on function public.my_shopping() from public, anon;
grant execute on function public.my_shopping() to authenticated;
