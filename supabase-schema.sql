-- THE SIGILS — shared archive schema.
-- Paste into Supabase: Dashboard → SQL Editor → New Query → Run.

-- 1. Table
create table if not exists public.reads (
  wallet        text        primary key,
  handle        text,
  sigil_name    text,
  tier          text,
  read_count    integer     not null default 1,
  first_read_at timestamptz not null default now(),
  last_read_at  timestamptz not null default now()
);

create index if not exists reads_last_read_at_idx on public.reads (last_read_at desc);
create index if not exists reads_read_count_idx   on public.reads (read_count   desc);

-- 2. Row Level Security. Anon may SELECT freely, but cannot write directly.
alter table public.reads enable row level security;

drop policy if exists "public_read" on public.reads;
create policy "public_read"
  on public.reads
  for select
  using (true);

-- 3. RPC: the ONLY way anon can write. Rate-limits to one write per wallet per 2s.
create or replace function public.record_read(
  p_wallet     text,
  p_handle     text,
  p_sigil_name text,
  p_tier       text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet text := lower(trim(p_wallet));
  v_last   timestamptz;
begin
  if v_wallet is null or length(v_wallet) < 3 then
    return;
  end if;

  select last_read_at into v_last
    from public.reads
    where wallet = v_wallet;

  if v_last is not null and now() - v_last < interval '2 seconds' then
    return;  -- silently drop rapid repeats from same wallet
  end if;

  insert into public.reads (wallet, handle, sigil_name, tier)
  values (v_wallet,
          nullif(trim(p_handle),     ''),
          nullif(trim(p_sigil_name), ''),
          nullif(trim(p_tier),       ''))
  on conflict (wallet) do update
    set handle       = coalesce(excluded.handle,     public.reads.handle),
        sigil_name   = coalesce(excluded.sigil_name, public.reads.sigil_name),
        tier         = coalesce(excluded.tier,       public.reads.tier),
        read_count   = public.reads.read_count + 1,
        last_read_at = now();
end;
$$;

grant execute on function public.record_read(text, text, text, text) to anon;
