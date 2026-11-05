-- =====================================================================
-- Pointie — Supabase schema
-- Run once in Supabase Dashboard → SQL Editor (safe to re-run).
--
-- Design: the browser never touches tables directly. Every read/write
-- goes through the SECURITY DEFINER functions below, which check
-- auth.uid() themselves. Tables have RLS enabled with no policies, so
-- direct table access from the public API is denied.
-- =====================================================================

-- No extensions needed: tokens use gen_random_uuid() (built into PostgreSQL 13+).
create or replace function public._token() returns text
language sql volatile as $$ select substr(replace(gen_random_uuid()::text, '-', ''), 1, 10) $$;

-- ---------------------------------------------------------------- tables
create table if not exists public.shops (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  owner_id    uuid references auth.users(id) on delete set null,
  data        jsonb not null default '{}'::jsonb,   -- name, cat, area, hours, card, promo, event, ...
  paused      boolean not null default false,
  sample      boolean not null default false,       -- demo shops shipped with the app
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists shops_owner_idx on public.shops(owner_id);

create table if not exists public.stands (
  id          uuid primary key default gen_random_uuid(),
  shop_id     text not null references public.shops(id) on delete cascade,
  name        text not null default 'สแตนด์',
  token       text not null unique default public._token(),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  rotated_at  timestamptz
);
create index if not exists stands_shop_idx on public.stands(shop_id);
alter table public.stands alter column token set default public._token();

create table if not exists public.customers (
  id          uuid primary key references auth.users(id) on delete cascade,
  nick        text not null default '',
  phone       text,
  profile     jsonb not null default '{}'::jsonb,   -- client-side game state: lv, xp, badges, prefs, ...
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.customers add column if not exists bonus_xp int not null default 0;  -- demo/admin grants
-- Identity (set at sign-up). Never shown to shops — they only see the nickname and
-- aggregated age generations.
alter table public.customers add column if not exists first_name text;
alter table public.customers add column if not exists last_name  text;
alter table public.customers add column if not exists birth_date date;

create table if not exists public.cards (
  customer_id    uuid not null references public.customers(id) on delete cascade,
  shop_id        text not null references public.shops(id) on delete cascade,
  have           int  not null default 0,
  visits         int  not null default 0,
  first_at       date not null default current_date,
  last_at        date,
  last_stamp     date,
  redeemed_count int  not null default 0,
  primary key (customer_id, shop_id)
);
create index if not exists cards_shop_idx on public.cards(shop_id);

create table if not exists public.events (
  id           bigserial primary key,
  shop_id      text not null references public.shops(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete set null,
  customer_key text not null,                         -- customer id, or a demo key
  nick         text not null default '',
  type         text not null check (type in ('stamp', 'redeem', 'review')),
  n            int,
  have         int,
  stars        int,
  demo         boolean not null default false,
  gen          text,  -- demo rows only; real rows derive the generation from customers.birth_date
  created_at   timestamptz not null default now()
);
alter table public.events add column if not exists gen text;
create index if not exists events_shop_time_idx on public.events(shop_id, created_at desc);

create table if not exists public.redemptions (
  id           uuid primary key default gen_random_uuid(),
  shop_id      text not null references public.shops(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete set null,
  nick         text not null default '',
  reward       text not null,
  code         text not null,
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'void')),
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid
);
create index if not exists redemptions_shop_idx on public.redemptions(shop_id, created_at desc);

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  shop_id      text not null references public.shops(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete cascade,
  nick         text not null default '',
  lv           int,
  stars        int not null check (stars between 1 and 5),
  text         text not null default '',
  reply        text,
  replied_at   timestamptz,
  sample       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (shop_id, customer_id)
);
alter table public.reviews add column if not exists gen text;  -- sample reviews only; real ones use customers.birth_date

-- Sign-up requests from the business landing page (the Pointie team calls them back).
-- View them in Supabase → Table Editor → leads.
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  phone       text not null,
  shop_name   text not null,
  shop_type   text not null,
  source      text,
  status      text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists leads_created_idx on public.leads(created_at desc);
alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;

-- deny-all: no policies on purpose, access only through the functions below
alter table public.shops       enable row level security;
alter table public.stands      enable row level security;
alter table public.customers   enable row level security;
alter table public.cards       enable row level security;
alter table public.events      enable row level security;
alter table public.redemptions enable row level security;
alter table public.reviews     enable row level security;
revoke all on public.shops, public.stands, public.customers, public.cards, public.events, public.redemptions, public.reviews from anon, authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function public._uid() returns uuid
language sql stable as $$ select auth.uid() $$;

create or replace function public._require_uid() returns uuid
language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  return u;
end $$;

create or replace function public._bkk_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

-- the caller's shop (merchant)
create or replace function public._my_shop_id() returns text
language plpgsql stable security definer set search_path = public as $$
declare sid text;
begin
  select id into sid from shops where owner_id = public._require_uid() order by created_at limit 1;
  if sid is null then raise exception 'no_shop' using errcode = '42501'; end if;
  return sid;
end $$;

-- Generation from birth year (Thai marketing convention).
create or replace function public._gen_of(d date) returns text
language sql immutable as $$
  select case when d is null then null
              when extract(year from d) >= 2013 then 'alpha'
              when extract(year from d) >= 1997 then 'z'
              when extract(year from d) >= 1981 then 'y'
              when extract(year from d) >= 1965 then 'x'
              else 'boomer' end
$$;

-- public shape of a shop (rating blends sample baseline with real reviews)
create or replace function public._shop_json(s public.shops) returns jsonb
language sql stable security definer set search_path = public as $$
  select s.data || jsonb_build_object(
    'id', s.id, 'paused', s.paused, 'sample', s.sample,
    'rating', round(((coalesce((s.data->>'rating')::numeric, 0) * coalesce((s.data->>'reviewsCount')::int, 0)
                     + coalesce(r.sum_stars, 0))
                    / nullif(coalesce((s.data->>'reviewsCount')::int, 0) + coalesce(r.n, 0), 0))::numeric, 1),
    'reviewsCount', coalesce((s.data->>'reviewsCount')::int, 0) + coalesce(r.n, 0),
    'reviews', coalesce(r.list, '[]'::jsonb),
    -- review score per generation (real reviews + demo activity); the app shows a
    -- generation only once it has enough reviews to stay anonymous
    'gens', coalesce((
      select jsonb_agg(jsonb_build_object('gen', g.gen, 'n', g.n, 'avg', round(g.avg_stars, 1)) order by g.gen)
      from (select gen, count(*) as n, avg(stars)::numeric as avg_stars from (
              select public._gen_of(c.birth_date) as gen, rv.stars from reviews rv join customers c on c.id = rv.customer_id
              where rv.shop_id = s.id and not rv.sample
              union all
              select e.gen, e.stars from events e where e.shop_id = s.id and e.type = 'review' and e.demo and e.gen is not null
            ) u where gen is not null group by gen) g), '[]'::jsonb)
  )
  from (select
          (select count(*) from reviews where shop_id = s.id and not sample) as n,
          (select sum(stars) from reviews where shop_id = s.id and not sample) as sum_stars,
          (select jsonb_agg(jsonb_build_object('id', x.id, 'customerId', x.customer_id, 'nick', x.nick, 'lv', x.lv, 'stars', x.stars, 'text', x.text,
                                               'reply', x.reply, 'sample', x.sample, 'at', x.created_at, 'gen', x.gen) order by x.sample, x.created_at desc)
             from (select rv.id, rv.customer_id, rv.nick, rv.lv, rv.stars, rv.text, rv.reply, rv.sample, rv.created_at,
                          coalesce(rv.gen, public._gen_of(c.birth_date)) as gen
                   from reviews rv left join customers c on c.id = rv.customer_id
                   where rv.shop_id = s.id order by rv.sample, rv.created_at desc limit 80) x) as list
       ) r
$$;

-- ---------------------------------------------------------------- public / customer API
-- Catalogue of visible shops (anyone).
create or replace function public.get_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._shop_json(s) order by s.sample desc, s.created_at), '[]'::jsonb)
  from shops s where not s.paused and s.data ? 'name'
$$;

-- Landing page sign-up form (anyone). Validates input, ignores repeats from the same
-- phone within 24 h, and refuses floods.
create or replace function public.submit_lead(p_first text, p_last text, p_phone text, p_shop text, p_type text, p_source text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if ph like '66%' and length(ph) = 11 then ph := '0' || substr(ph, 3); end if;
  if length(trim(coalesce(p_first, ''))) = 0 or length(trim(coalesce(p_last, ''))) = 0
     or length(trim(coalesce(p_shop, ''))) = 0 or length(trim(coalesce(p_type, ''))) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if ph !~ '^0[0-9]{8,9}$' then return jsonb_build_object('ok', false, 'reason', 'phone'); end if;
  if exists (select 1 from leads where phone = ph and created_at > now() - interval '24 hours') then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if (select count(*) from leads where created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;
  insert into leads (first_name, last_name, phone, shop_name, shop_type, source)
  values (left(trim(p_first), 60), left(trim(p_last), 60), ph, left(trim(p_shop), 80), left(trim(p_type), 60), left(p_source, 120));
  return jsonb_build_object('ok', true);
end $$;

-- Live platform numbers for the public landing page (real activity only — no samples/demo).
create or replace function public.public_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shops',       (select count(*) from shops where not sample and not paused and owner_id is not null),
    'customers',   (select count(*) from customers),
    'stamps',      (select coalesce(sum(n), 0) from events where type = 'stamp' and not demo and customer_id is not null),
    'redemptions', (select count(*) from redemptions where customer_id is not null),
    'reviews',     (select count(*) from reviews where not sample)
  )
$$;

-- Is this stand link usable? (anyone) → 'ok' | 'off' | 'unknown'
create or replace function public.check_stand(p_shop text, p_token text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select case when active then 'ok' else 'off' end from stands where shop_id = p_shop and token = p_token), 'unknown')
$$;

-- Create/refresh the customer row for the signed-in user.
create or replace function public.customer_upsert(p_nick text, p_phone text, p_profile jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_uid(); ap text;
begin
  -- With real SMS sign-in the verified number comes from auth, never from the browser.
  select phone into ap from auth.users where id = u;
  if coalesce(ap, '') <> '' then p_phone := '0' || right(regexp_replace(ap, '\D', '', 'g'), 9); end if;
  insert into customers (id, nick, phone, profile)
  values (u, left(coalesce(p_nick, ''), 20), p_phone, coalesce(p_profile, '{}'::jsonb))
  on conflict (id) do update
    set nick = coalesce(nullif(left(excluded.nick, 20), ''), customers.nick),
        phone = coalesce(excluded.phone, customers.phone),
        profile = case when p_profile is null then customers.profile else excluded.profile end,
        updated_at = now();
  return public.my_state();
end $$;

-- ---------------------------------------------------------------- XP / levels / tiers
-- XP is computed on the server from verifiable activity, so levels can carry real perks:
--   20 per visit (stamp) · 30 per review · 50 sign-up · 30 preferences · weekly missions
--   (5 stamps +50, 1 review +30, 3 new cafés +100) · bonus_xp (demo/admin)
create or replace function public._level_info(p_xp int) returns jsonb
language plpgsql immutable as $$
declare lv int := 1; rest int := greatest(coalesce(p_xp, 0), 0); need int;
begin
  loop
    need := greatest(100, 150 * lv - 550);
    exit when rest < need;
    rest := rest - need; lv := lv + 1;
  end loop;
  return jsonb_build_object('xp', coalesce(p_xp, 0), 'lv', lv, 'inLevel', rest, 'need', need,
    'tier', case when lv >= 15 then 'legend' when lv >= 10 then 'pro' when lv >= 5 then 'regular' else 'explorer' end);
end $$;

create or replace function public._xp_of(u uuid) returns int
language sql stable security definer set search_path = public as $$
  with c as (select coalesce(sum(visits), 0) as v from cards where customer_id = u),
  r as (select count(*) as n from reviews where customer_id = u and not sample),
  cu as (select coalesce(bonus_xp, 0) as bonus, coalesce((profile #>> '{user,prefsDone}')::boolean, false) as prefs from customers where id = u),
  wk as (
    select date_trunc('week', created_at at time zone 'Asia/Bangkok') as w,
           coalesce(sum(n) filter (where type = 'stamp'), 0) as stamps,
           count(*) filter (where type = 'review') as reviews
    from events where customer_id = u group by 1),
  firsts as (
    select date_trunc('week', min(created_at) at time zone 'Asia/Bangkok') as w, shop_id
    from events where customer_id = u and type = 'stamp' group by shop_id),
  cafes as (select f.w, count(*) as n from firsts f join shops s on s.id = f.shop_id and s.data->>'cat' = 'cafe' group by f.w),
  missions as (select coalesce(sum(case when stamps >= 5 then 50 else 0 end + case when reviews >= 1 then 30 else 0 end), 0) as x from wk),
  cafe_missions as (select coalesce(sum(case when n >= 3 then 100 else 0 end), 0) as x from cafes)
  select case when cu.bonus is null then 0
              else (20 * c.v + 30 * r.n + 50 + case when cu.prefs then 30 else 0 end + cu.bonus + missions.x + cafe_missions.x)::int end
  from c cross join r cross join missions cross join cafe_missions left join cu on true
$$;

create or replace function public._level_of(u uuid) returns jsonb
language sql stable security definer set search_path = public as $$ select public._level_info(public._xp_of(u)) $$;

create or replace function public.my_level() returns jsonb
language sql stable security definer set search_path = public as $$ select public._level_of(public._require_uid()) $$;

-- Everything the customer app needs about "me".
create or replace function public.my_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := public._require_uid(); c customers;
begin
  select * into c from customers where id = u;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', c.id, 'nick', c.nick, 'phone', c.phone, 'profile', c.profile, 'createdAt', c.created_at,
    'cards', coalesce((select jsonb_object_agg(shop_id, jsonb_build_object('have', have, 'visits', visits, 'first', first_at,
                        'last', last_at, 'lastStamp', last_stamp, 'redeemedCount', redeemed_count)) from cards where customer_id = u), '{}'::jsonb),
    'redeemed', coalesce((select jsonb_agg(jsonb_build_object('shopId', shop_id, 'reward', reward, 'at', created_at, 'code', code, 'status', status)
                        order by created_at desc) from (select * from redemptions where customer_id = u order by created_at desc limit 50) r), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('shopId', shop_id, 'stars', stars, 'text', text, 'date', (created_at at time zone 'Asia/Bangkok')::date, 'reply', reply))
                        from reviews where customer_id = u), '[]'::jsonb),
    'today', public._bkk_today(),
    'level', public._level_of(u),
    'identity', jsonb_build_object('firstName', c.first_name, 'lastName', c.last_name, 'birthDate', c.birth_date, 'gen', public._gen_of(c.birth_date))
  );
end $$;

drop function if exists public.save_profile(jsonb, text);
create or replace function public.save_profile(p_profile jsonb, p_nick text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_uid();
begin
  update customers set profile = coalesce(p_profile, profile), nick = coalesce(nullif(left(p_nick, 20), ''), nick), updated_at = now()
  where id = u;
  return public._level_of(u);
end $$;

-- Sign-up identity: real name + birth date (13+). Shops never see these.
create or replace function public.save_identity(p_first text, p_last text, p_birth date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_uid(); today date := public._bkk_today();
begin
  if length(trim(coalesce(p_first, ''))) = 0 or length(trim(coalesce(p_last, ''))) = 0 or p_birth is null then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if p_birth < date '1920-01-01' or p_birth > today then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if p_birth > (today - interval '13 years')::date then return jsonb_build_object('ok', false, 'reason', 'too_young'); end if;
  update customers set first_name = left(trim(p_first), 60), last_name = left(trim(p_last), 60), birth_date = p_birth, updated_at = now()
  where id = u;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  return jsonb_build_object('ok', true, 'gen', public._gen_of(p_birth));
end $$;

-- Tap: one stamp per shop per Bangkok day; x2 on promo days; token = stand link (optional).
create or replace function public.collect_stamp(p_shop text, p_token text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := public._require_uid();
  s shops; c cards; cu customers;
  today date := public._bkk_today();
  need int; add_n int := 1; before int; is_new boolean := false; tier_bonus int := 0; lvl jsonb;
begin
  select * into cu from customers where id = u;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  select * into s from shops where id = p_shop;
  if not found or s.paused then return jsonb_build_object('ok', false, 'reason', 'unknown'); end if;
  if p_token is not null and p_token <> '' and public.check_stand(p_shop, p_token) <> 'ok' then
    return jsonb_build_object('ok', false, 'reason', 'stand_off');
  end if;
  need := coalesce((s.data #>> '{card,need}')::int, 10);

  select * into c from cards where customer_id = u and shop_id = p_shop for update;
  if not found then
    insert into cards (customer_id, shop_id, first_at) values (u, p_shop, today) returning * into c;
    is_new := true;
  end if;
  if c.last_stamp = today then return jsonb_build_object('ok', false, 'reason', 'already'); end if;
  if c.have >= need then return jsonb_build_object('ok', false, 'reason', 'full'); end if;

  if coalesce((s.data->>'promo')::boolean, false)
     and s.data #>> '{promoRule,type}' = 'double'
     and (s.data #> '{promoRule,days}') @> to_jsonb(extract(dow from today)::int) then
    add_n := 2;
  end if;
  -- Regular tier and above: +1 bonus stamp on the first visit to a shop
  if is_new and public._level_of(u)->>'tier' <> 'explorer' then
    tier_bonus := 1; add_n := add_n + 1;
  end if;
  before := c.have;
  update cards set have = least(need, have + add_n), visits = visits + 1, last_at = today, last_stamp = today
  where customer_id = u and shop_id = p_shop returning * into c;

  insert into events (shop_id, customer_id, customer_key, nick, type, n, have)
  values (p_shop, u, u::text, cu.nick, 'stamp', c.have - before, c.have);

  return jsonb_build_object('ok', true, 'added', c.have - before, 'have', c.have, 'need', need, 'visits', c.visits,
                            'full', c.have >= need, 'isNewShop', is_new, 'today', today, 'tierBonus', tier_bonus,
                            'level', public._level_of(u));
end $$;

-- Redeem a full card → pending redemption with a 4-digit code for staff.
create or replace function public.redeem_card(p_shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_uid(); s shops; c cards; cu customers; need int; code text; r redemptions;
begin
  select * into s from shops where id = p_shop;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown'); end if;
  need := coalesce((s.data #>> '{card,need}')::int, 10);
  select * into c from cards where customer_id = u and shop_id = p_shop for update;
  if not found or c.have < need then return jsonb_build_object('ok', false, 'reason', 'not_full'); end if;
  select * into cu from customers where id = u;
  code := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
  update cards set have = 0, redeemed_count = redeemed_count + 1 where customer_id = u and shop_id = p_shop;
  insert into redemptions (shop_id, customer_id, nick, reward, code)
  values (p_shop, u, cu.nick, coalesce(s.data #>> '{card,reward}', 'รางวัล'), code) returning * into r;
  insert into events (shop_id, customer_id, customer_key, nick, type) values (p_shop, u, u::text, cu.nick, 'redeem');
  return jsonb_build_object('ok', true, 'code', code, 'reward', r.reward, 'at', r.created_at, 'id', r.id);
end $$;

-- Reviews only from customers who really visited.
create or replace function public.submit_review(p_shop text, p_stars int, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_uid(); cu customers; existed boolean;
begin
  if not exists (select 1 from cards where customer_id = u and shop_id = p_shop and visits > 0) then
    return jsonb_build_object('ok', false, 'reason', 'not_visited');
  end if;
  if p_stars not between 1 and 5 or length(trim(coalesce(p_text, ''))) < 5 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select * into cu from customers where id = u;
  existed := exists (select 1 from reviews where shop_id = p_shop and customer_id = u);
  insert into reviews (shop_id, customer_id, nick, lv, stars, text)
  values (p_shop, u, cu.nick, (public._level_of(u)->>'lv')::int, p_stars, left(trim(p_text), 500))
  on conflict (shop_id, customer_id) do update set stars = excluded.stars, text = excluded.text, nick = excluded.nick, lv = excluded.lv, updated_at = now();
  if not existed then
    insert into events (shop_id, customer_id, customer_key, nick, type, stars) values (p_shop, u, u::text, cu.nick, 'review', p_stars);
  end if;
  return jsonb_build_object('ok', true, 'updated', existed, 'level', public._level_of(u));
end $$;

-- Demo only: give the signed-in user the sample cards from the design (sample shops only).
create or replace function public.seed_demo_cards() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_uid(); t date := public._bkk_today();
begin
  insert into cards (customer_id, shop_id, have, visits, first_at, last_at, last_stamp)
  select u, x.shop, x.have, x.visits, x.first::date, t - x.ago, t - x.ago
  from (values ('baan', 6, 11, '2026-03-08', 3), ('jae', 8, 9, '2026-03-20', 2), ('climb', 3, 3, '2026-08-02', 9),
               ('plant', 2, 2, '2026-09-14', 12), ('book', 2, 2, '2026-10-01', 6)) as x(shop, have, visits, first, ago)
  join shops s on s.id = x.shop and s.sample
  on conflict (customer_id, shop_id) do nothing;
  update customers set bonus_xp = 670,  -- design demo: Lv.7, 340/500 XP
                       first_name = coalesce(first_name, 'ณัฐชา'), last_name = coalesce(last_name, 'ตัวอย่าง'),
                       birth_date = coalesce(birth_date, date '1999-03-08')
  where id = u;
  return public.my_state();
end $$;

-- Customer deletes their account and personal data (cards, reviews; events keep no link).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare u uuid := public._require_uid();
begin
  delete from public.customers where id = u;
  delete from auth.users where id = u;
end $$;

-- ---------------------------------------------------------------- merchant API
create or replace function public.merchant_create_shop(p_name text, p_name_en text, p_cat text, p_area text) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_uid(); base text; sid text; n int := 1;
begin
  if exists (select 1 from shops where owner_id = u) then raise exception 'already_has_shop'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'name_required'; end if;
  base := trim(both '-' from regexp_replace(lower(coalesce(nullif(p_name_en, ''), 'shop')), '[^a-z0-9]+', '-', 'g'));
  base := left(case when length(base) < 2 then 'shop' else base end, 32);
  sid := base;
  while exists (select 1 from shops where id = sid) loop n := n + 1; sid := base || '-' || n; end loop;
  insert into shops (id, owner_id, data) values (sid, u, jsonb_build_object(
    'name', trim(p_name), 'initials', left(replace(trim(p_name), ' ', ''), 2), 'cat', coalesce(nullif(p_cat, ''), 'cafe'),
    'area', coalesce(nullif(p_area, ''), 'อารีย์'), 'x', 200, 'y', 360, 'created', true,
    'hours', 'ทุกวัน 09:00–18:00', 'closed', 'เปิดทุกวัน', 'openAt', 9, 'closeAt', 18, 'rating', 0, 'reviewsCount', 0,
    'address', '', 'phone', '', 'promo', false, 'promoText', '', 'promoUntil', '', 'promoRule', null,
    'summary', '', 'tags', '[]'::jsonb, 'dist5', '[0,0,0,0,0]'::jsonb, 'photos', 0,
    'card', jsonb_build_object('en', upper(coalesce(nullif(p_name_en, ''), p_name)), 'l1', split_part(trim(p_name), ' ', 1),
                               'l2', nullif(substr(trim(p_name), length(split_part(trim(p_name), ' ', 1)) + 2), ''), 'need', 8,
                               'reward', 'ส่วนลด 50 บาท', 'bg', '#8C2F1C', 'photo', false, 'letter', '#FFD23F', 'glyph', 'star')));
  return sid;
end $$;

-- Demo: take over an unowned sample shop (e.g. บ้านกาแฟริมคลอง) to explore a full dashboard.
create or replace function public.merchant_claim_sample(p_shop text) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_uid();
begin
  if exists (select 1 from shops where owner_id = u) then raise exception 'already_has_shop'; end if;
  update shops set owner_id = u, updated_at = now() where id = p_shop and sample and owner_id is null;
  if not found then raise exception 'not_available'; end if;
  return p_shop;
end $$;

create or replace function public.merchant_samples_available() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', data->>'name') order by created_at), '[]'::jsonb)
  from shops where sample and owner_id is null
$$;

-- All data the merchant web needs, in one call.
create or replace function public.merchant_bundle(p_days int default 90) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sid text := public._my_shop_id(); s shops;
begin
  select * into s from shops where id = sid;
  return jsonb_build_object(
    'shop', public._shop_json(s),
    'stands', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'token', token, 'active', active, 'createdAt', created_at, 'rotatedAt', rotated_at) order by created_at)
                        from stands where shop_id = sid), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('type', e.type, 'customer', e.customer_key, 'nick', e.nick, 'n', e.n, 'have', e.have, 'stars', e.stars,
                                                         'at', e.created_at, 'demo', e.demo, 'gen', coalesce(e.gen, public._gen_of(c.birth_date))) order by e.created_at)
                        from events e left join customers c on c.id = e.customer_id
                        where e.shop_id = sid and e.created_at > now() - make_interval(days => greatest(p_days, 1) * 2 + 1)), '[]'::jsonb),
    'redemptions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nick', nick, 'reward', reward, 'code', code, 'status', status, 'at', created_at, 'confirmedAt', confirmed_at) order by created_at desc)
                        from (select * from redemptions where shop_id = sid order by created_at desc limit 200) r), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nick', nick, 'stars', stars, 'text', text, 'reply', reply, 'sample', sample, 'at', created_at) order by sample, created_at desc)
                        from reviews where shop_id = sid), '[]'::jsonb),
    'levels', coalesce((select jsonb_object_agg(x.customer_id::text, public._level_of(x.customer_id) - 'xp' - 'inLevel' - 'need')
                        from (select distinct customer_id from events where shop_id = sid and customer_id is not null) x), '{}'::jsonb)
  );
end $$;

-- Patch shop data (top-level keys replace; `paused` is a column).
create or replace function public.merchant_update_shop(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid text := public._my_shop_id(); clean jsonb := coalesce(p_patch, '{}'::jsonb) - 'id' - 'paused' - 'sample' - 'reviews' - 'stands';
begin
  if pg_column_size(clean) > 400000 then raise exception 'too_large'; end if;
  update shops set data = data || clean,
                   paused = coalesce((p_patch->>'paused')::boolean, paused),
                   updated_at = now()
  where id = sid;
  return public._shop_json((select s from shops s where id = sid));
end $$;

create or replace function public.merchant_add_stand(p_name text) returns void
language sql security definer set search_path = public as $$
  insert into stands (shop_id, name) values (public._my_shop_id(), coalesce(nullif(left(trim(p_name), 30), ''), 'สแตนด์'))
$$;
create or replace function public.merchant_update_stand(p_id uuid, p_active boolean, p_rotate boolean default false) returns void
language sql security definer set search_path = public as $$
  update stands set active = coalesce(p_active, active),
                    token = case when p_rotate then public._token() else token end,
                    rotated_at = case when p_rotate then now() else rotated_at end
  where id = p_id and shop_id = public._my_shop_id()
$$;
create or replace function public.merchant_delete_stand(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from stands where id = p_id and shop_id = public._my_shop_id()
$$;

create or replace function public.merchant_find_redemption(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'nick', nick, 'reward', reward, 'code', code, 'status', status, 'at', created_at)
  from redemptions
  where shop_id = public._my_shop_id() and code = p_code and status = 'pending' and created_at > now() - interval '24 hours'
  order by created_at desc limit 1
$$;
create or replace function public.merchant_set_redemption(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('confirmed', 'void') then raise exception 'bad_status'; end if;
  update redemptions set status = p_status, confirmed_at = now(), confirmed_by = auth.uid()
  where id = p_id and shop_id = public._my_shop_id() and status = 'pending';
end $$;

create or replace function public.merchant_reply_review(p_id uuid, p_reply text) returns void
language sql security definer set search_path = public as $$
  update reviews set reply = nullif(left(trim(coalesce(p_reply, '')), 300), ''), replied_at = now()
  where id = p_id and shop_id = public._my_shop_id()
$$;

-- ---------------------------------------------------------------- grants
-- only touch Pointie's own functions (leave anything else in the project alone)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in (
             '_uid','_require_uid','_bkk_today','_token','_gen_of','save_identity','_level_info','_xp_of','_level_of','my_level','public_stats','submit_lead','_my_shop_id','_shop_json','get_catalog','check_stand','customer_upsert','my_state','save_profile','collect_stamp','redeem_card','submit_review','seed_demo_cards','delete_my_account',
             'merchant_create_shop','merchant_claim_sample','merchant_samples_available','merchant_bundle','merchant_update_shop',
             'merchant_add_stand','merchant_update_stand','merchant_delete_stand','merchant_find_redemption','merchant_set_redemption','merchant_reply_review')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
grant execute on function public.get_catalog(), public.check_stand(text, text), public.merchant_samples_available(), public.public_stats(),
  public.submit_lead(text, text, text, text, text, text) to anon, authenticated;
grant execute on function
  public.customer_upsert(text, text, jsonb), public.my_state(), public.save_profile(jsonb, text), public.my_level(), public.save_identity(text, text, date),
  public.collect_stamp(text, text), public.redeem_card(text), public.submit_review(text, int, text), public.seed_demo_cards(),
  public.delete_my_account(),
  public.merchant_create_shop(text, text, text, text), public.merchant_claim_sample(text),
  public.merchant_bundle(int), public.merchant_update_shop(jsonb),
  public.merchant_add_stand(text), public.merchant_update_stand(uuid, boolean, boolean), public.merchant_delete_stand(uuid),
  public.merchant_find_redemption(text), public.merchant_set_redemption(uuid, text), public.merchant_reply_review(uuid, text)
to authenticated;
