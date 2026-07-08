create table if not exists public.inboxes (
  id uuid primary key,
  handle text not null unique,
  pen_name text not null,
  owner_email text not null,
  avatar_url text default '',
  bio text default '',
  owner_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.letters (
  id uuid primary key,
  inbox_id uuid not null references public.inboxes(id) on delete cascade,
  body text not null,
  status text not null default 'new',
  reply text default '',
  created_at timestamptz not null default now(),
  replied_at timestamptz,
  archived_at timestamptz
);

create index if not exists letters_inbox_id_created_at_idx
  on public.letters (inbox_id, created_at desc);

create index if not exists letters_status_idx
  on public.letters (status);
