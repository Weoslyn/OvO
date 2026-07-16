create table if not exists public.inboxes (
  id uuid primary key,
  handle text not null unique,
  pen_name text not null,
  owner_email text,
  avatar_url text default '',
  bio text default '',
  owner_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.letters (
  id uuid primary key,
  inbox_id uuid not null references public.inboxes(id) on delete cascade,
  sender_inbox_id uuid references public.inboxes(id) on delete set null,
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

alter table public.inboxes
  alter column owner_email drop not null;

alter table public.letters
  add column if not exists sender_inbox_id uuid references public.inboxes(id) on delete set null;

create index if not exists letters_sender_inbox_id_created_at_idx
  on public.letters (sender_inbox_id, created_at desc);

create table if not exists public.square_posts (
  id uuid primary key,
  inbox_id uuid not null references public.inboxes(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists square_posts_created_at_idx
  on public.square_posts (created_at desc);

create table if not exists public.square_post_likes (
  id uuid primary key,
  post_id uuid not null references public.square_posts(id) on delete cascade,
  voter_id text not null,
  created_at timestamptz not null default now(),
  unique (post_id, voter_id)
);

create index if not exists square_post_likes_post_id_idx
  on public.square_post_likes (post_id);

create table if not exists public.square_comments (
  id uuid primary key,
  post_id uuid not null references public.square_posts(id) on delete cascade,
  author_mode text not null default 'anonymous',
  author_name text default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists square_comments_post_id_created_at_idx
  on public.square_comments (post_id, created_at asc);

create table if not exists public.square_comment_likes (
  id uuid primary key,
  comment_id uuid not null references public.square_comments(id) on delete cascade,
  voter_id text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, voter_id)
);

create index if not exists square_comment_likes_comment_id_idx
  on public.square_comment_likes (comment_id);
