-- P45 Global Education Marketplace
-- Paid ownership, signed certificates and revenue settlement are server-owned.

create table if not exists public.global_marketplace_teacher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  bio text not null default '' check (char_length(bio) <= 1000),
  experience_years smallint not null default 0 check (experience_years between 0 and 80),
  specialties jsonb not null default '[]'::jsonb,
  languages text[] not null default array['ko'],
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  verified boolean not null default false,
  status text not null default 'draft' check (status in ('draft','in_review','approved','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.global_marketplace_courses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid references public.global_marketplace_teacher_profiles(user_id) on delete set null,
  language_code text not null default 'ko' check (language_code in ('ko','ja','zh','en')),
  title text not null check (char_length(title) between 3 and 140),
  description text not null default '' check (char_length(description) <= 1800),
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  category text not null check (char_length(category) between 2 and 80),
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'VND' check (currency in ('VND','USD')),
  version text not null default '1.0.0',
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','approved','published','rejected','deprecated')),
  verified boolean not null default false,
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or verified),
  check (status not in ('approved','published') or (moderated_by is not null and moderated_by <> creator_id))
);

create table if not exists public.global_marketplace_creator_content (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.global_marketplace_courses(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('lesson','vocabulary','practice')),
  language_code text not null default 'ko' check (language_code in ('ko','ja','zh','en')),
  title text not null check (char_length(title) between 3 and 140),
  description text not null default '' check (char_length(description) <= 1800),
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','approved','rejected','deprecated')),
  moderation_note text not null default '' check (char_length(moderation_note) <= 1200),
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('approved','rejected') or (moderated_by is not null and moderated_by <> creator_id))
);

create table if not exists public.global_marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.global_marketplace_courses(id) on delete restrict,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency in ('VND','USD')),
  status text not null default 'checkout_created' check (status in ('checkout_created','paid','refunded','canceled')),
  provider text not null check (char_length(provider) between 2 and 40),
  provider_reference text,
  idempotency_key text not null unique check (char_length(idempotency_key) between 12 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.global_marketplace_ownerships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.global_marketplace_courses(id) on delete cascade,
  order_id uuid references public.global_marketplace_orders(id) on delete restrict,
  source text not null check (source in ('free','signed_webhook','admin_grant')),
  status text not null default 'active' check (status in ('active','revoked','refunded')),
  granted_at timestamptz not null default now(),
  unique (user_id, course_id),
  check ((source = 'free' and order_id is null) or source <> 'free')
);

create table if not exists public.global_marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.global_marketplace_courses(id) on delete cascade,
  quality smallint not null check (quality between 1 and 5),
  difficulty smallint not null check (difficulty between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1200),
  status text not null default 'published' check (status in ('published','hidden','reported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.global_marketplace_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null unique references public.global_marketplace_orders(id) on delete restrict,
  gross_minor integer not null check (gross_minor >= 0),
  creator_share_minor integer not null check (creator_share_minor >= 0),
  platform_share_minor integer not null check (platform_share_minor >= 0),
  currency text not null check (currency in ('VND','USD')),
  status text not null default 'pending' check (status in ('pending','available','paid','reversed')),
  available_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  check (creator_share_minor + platform_share_minor = gross_minor)
);

create table if not exists public.global_marketplace_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.global_marketplace_courses(id) on delete cascade,
  certificate_code text not null unique,
  completion_percent smallint not null check (completion_percent = 100),
  status text not null default 'valid' check (status in ('valid','revoked')),
  issued_at timestamptz not null default now(),
  signature text not null,
  unique (user_id, course_id)
);

create table if not exists public.global_marketplace_moderation_log (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.global_marketplace_creator_content(id) on delete cascade,
  moderator_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved','changes_requested','rejected')),
  note text not null default '' check (char_length(note) <= 1200),
  created_at timestamptz not null default now()
);

create index if not exists global_marketplace_courses_catalog_idx on public.global_marketplace_courses(language_code, status, difficulty);
create index if not exists global_marketplace_content_creator_idx on public.global_marketplace_creator_content(creator_id, status, updated_at desc);
create index if not exists global_marketplace_orders_user_idx on public.global_marketplace_orders(user_id, created_at desc);
create index if not exists global_marketplace_ownership_user_idx on public.global_marketplace_ownerships(user_id, status);
create index if not exists global_marketplace_reviews_course_idx on public.global_marketplace_reviews(course_id, status);
create index if not exists global_marketplace_revenue_creator_idx on public.global_marketplace_revenue_ledger(creator_id, status, created_at desc);
create index if not exists global_marketplace_certificates_user_idx on public.global_marketplace_certificates(user_id, issued_at desc);

alter table public.global_marketplace_teacher_profiles enable row level security;
alter table public.global_marketplace_courses enable row level security;
alter table public.global_marketplace_creator_content enable row level security;
alter table public.global_marketplace_orders enable row level security;
alter table public.global_marketplace_ownerships enable row level security;
alter table public.global_marketplace_reviews enable row level security;
alter table public.global_marketplace_revenue_ledger enable row level security;
alter table public.global_marketplace_certificates enable row level security;
alter table public.global_marketplace_moderation_log enable row level security;

create policy "authenticated read approved teachers" on public.global_marketplace_teacher_profiles for select to authenticated
  using (status = 'approved' or user_id = auth.uid() or public.has_any_role(array['content_editor','admin']));
create policy "teachers create own unverified profile" on public.global_marketplace_teacher_profiles for insert to authenticated
  with check (user_id = auth.uid() and public.has_any_role(array['teacher','content_editor','admin']) and not verified and status <> 'approved');
create policy "teachers update own unverified profile" on public.global_marketplace_teacher_profiles for update to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['content_editor','admin']))
  with check ((user_id = auth.uid() and not verified and status <> 'approved') or public.has_any_role(array['content_editor','admin']));

create policy "authenticated read published marketplace courses" on public.global_marketplace_courses for select to authenticated
  using ((status = 'published' and verified) or creator_id = auth.uid() or public.has_any_role(array['content_editor','admin']));
create policy "creators create marketplace drafts" on public.global_marketplace_courses for insert to authenticated
  with check (creator_id = auth.uid() and public.has_any_role(array['teacher','content_editor','admin']) and not verified and status not in ('approved','published'));
create policy "creators update marketplace drafts" on public.global_marketplace_courses for update to authenticated
  using (creator_id = auth.uid() or public.has_any_role(array['content_editor','admin']))
  with check ((creator_id = auth.uid() and not verified and status not in ('approved','published')) or public.has_any_role(array['content_editor','admin']));

create policy "creators read own content and moderators read queue" on public.global_marketplace_creator_content for select to authenticated
  using (creator_id = auth.uid() or public.has_any_role(array['content_editor','admin']));
create policy "creators insert own drafts" on public.global_marketplace_creator_content for insert to authenticated
  with check (creator_id = auth.uid() and public.has_any_role(array['teacher','content_editor','admin']) and status = 'draft');
create policy "creators update only unpublished content" on public.global_marketplace_creator_content for update to authenticated
  using (creator_id = auth.uid() or public.has_any_role(array['content_editor','admin']))
  with check ((creator_id = auth.uid() and status in ('draft','in_review','changes_requested')) or public.has_any_role(array['content_editor','admin']));

-- Checkout/order writes are deliberately absent: only the trusted backend service role writes them.
create policy "users read own marketplace orders" on public.global_marketplace_orders for select to authenticated using (user_id = auth.uid());

create policy "users read own marketplace ownership" on public.global_marketplace_ownerships for select to authenticated using (user_id = auth.uid());
create policy "users enroll only in approved free courses" on public.global_marketplace_ownerships for insert to authenticated
  with check (
    user_id = auth.uid() and source = 'free' and order_id is null and status = 'active'
    and exists (select 1 from public.global_marketplace_courses c where c.id = course_id and c.status = 'published' and c.verified and c.price_minor = 0)
  );

create policy "authenticated read published marketplace reviews" on public.global_marketplace_reviews for select to authenticated
  using (status = 'published' or user_id = auth.uid() or public.has_any_role(array['content_editor','admin']));
create policy "verified buyers create one review" on public.global_marketplace_reviews for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.global_marketplace_ownerships o where o.user_id = auth.uid() and o.course_id = global_marketplace_reviews.course_id and o.status = 'active'));
create policy "users update own review" on public.global_marketplace_reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ledger writes and payout transitions are deliberately absent from browser policies.
create policy "creators read own revenue ledger" on public.global_marketplace_revenue_ledger for select to authenticated
  using (creator_id = auth.uid() or public.has_any_role(array['admin']));

-- Certificates are signed by the backend; the browser has read-only access to its own certificates.
create policy "users read own marketplace certificates" on public.global_marketplace_certificates for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['admin']));

create policy "moderators read marketplace moderation log" on public.global_marketplace_moderation_log for select to authenticated
  using (public.has_any_role(array['content_editor','admin']));
create policy "moderators create marketplace decisions" on public.global_marketplace_moderation_log for insert to authenticated
  with check (moderator_id = auth.uid() and public.has_any_role(array['content_editor','admin']));

comment on table public.global_marketplace_orders is 'Server-owned checkout records. No browser insert/update policy prevents client-side paid grants.';
comment on table public.global_marketplace_revenue_ledger is 'Immutable-from-browser creator revenue ledger. Payout state is updated by trusted backend jobs only.';
comment on table public.global_marketplace_certificates is 'Backend-signed course certificates; local previews are never stored as valid certificates.';
comment on table public.global_marketplace_teacher_profiles is 'Public teaching fields only. Payment, email and private identity data belong in private server-owned storage.';
