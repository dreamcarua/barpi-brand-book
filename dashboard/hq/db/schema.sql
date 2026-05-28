-- =====================================================================
-- Barpi HQ — Стіл SMM
-- Postgres-схема для Supabase
-- v1.0 — травень 2026 (форк DreamCar HQ v1.3, applied to project barpi-hq)
--
-- Supabase project: barpi-hq (id zrcqmwlpsggiqgipvxhv, eu-central-1)
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

do $$ begin create type user_role          as enum ('ceo', 'coo', 'lead', 'member', 'designer');                          exception when duplicate_object then null; end $$;
do $$ begin create type publication_status as enum ('draft', 'in_work', 'review', 'approved', 'published', 'rework');     exception when duplicate_object then null; end $$;
do $$ begin create type content_type       as enum ('post', 'reels', 'stories', 'carousel', 'longread');                  exception when duplicate_object then null; end $$;
do $$ begin create type platform           as enum ('ig', 'tg', 'tt', 'th', 'yt', 'fb');                                  exception when duplicate_object then null; end $$;
do $$ begin create type creative_type      as enum ('photo', 'video', 'doc', 'audio');                                    exception when duplicate_object then null; end $$;
do $$ begin create type approver_policy    as enum ('all', 'any');                                                        exception when duplicate_object then null; end $$;
do $$ begin create type responsibility     as enum ('scriptwriter', 'videographer', 'editor', 'publisher', 'generic');    exception when duplicate_object then null; end $$;

create table if not exists users (
    id uuid primary key default uuid_generate_v4(),
    auth_id uuid unique references auth.users(id) on delete cascade,
    email text unique not null,
    name text not null,
    initial text generated always as (upper(substring(name, 1, 1))) stored,
    role user_role not null default 'member',
    telegram_username text, avatar_url text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists desks (
    id uuid primary key default uuid_generate_v4(),
    slug text unique not null, name text not null, color text,
    created_at timestamptz not null default now()
);
insert into desks (id, slug, name, color)
values ('11111111-1111-1111-1111-111111111111', 'smm', 'Стіл SMM Barpi', '#2F6FED')
on conflict (slug) do nothing;

create table if not exists desk_members (
    desk_id uuid not null references desks(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    desk_role user_role not null,
    added_at timestamptz not null default now(),
    primary key (desk_id, user_id)
);

create table if not exists rubrics (
    id uuid primary key default uuid_generate_v4(),
    desk_id uuid not null references desks(id) on delete cascade,
    slug text not null, name text not null, color text, sort_order int not null default 0,
    created_at timestamptz not null default now(),
    unique (desk_id, slug)
);

create table if not exists launches (
    id uuid primary key default uuid_generate_v4(),
    desk_id uuid not null references desks(id) on delete cascade,
    name text not null, starts_on date, ends_on date, color text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists creatives (
    id uuid primary key default uuid_generate_v4(),
    desk_id uuid not null references desks(id) on delete cascade,
    name text not null, type creative_type not null,
    drive_file_id text, size_bytes bigint, duration_sec int, width_px int, height_px int,
    thumbnail_url text, tags text[] not null default array[]::text[],
    rubric_id uuid references rubrics(id) on delete set null,
    uploaded_by uuid not null references users(id),
    uploaded_at timestamptz not null default now(),
    archived_at timestamptz, deleted_at timestamptz
);

create table if not exists publications (
    id uuid primary key default uuid_generate_v4(),
    desk_id uuid not null references desks(id) on delete cascade,
    title text not null, publish_at timestamptz not null,
    content_type content_type not null,
    text_body text not null default '',
    hashtags text[] not null default array[]::text[],
    rubric_id uuid references rubrics(id) on delete set null,
    launch_id uuid references launches(id) on delete set null,
    status publication_status not null default 'draft',
    approver_policy approver_policy not null default 'all',
    deadline_on date, published_url text, published_at timestamptz,
    created_by uuid not null references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    search_tsv tsvector
);

-- + інші таблиці: publication_platforms, publication_responsibles, publication_approvers,
-- creative_publications, publication_history, comments, publication_drafts,
-- editing_sessions, notifications, notification_preferences, access_requests, user_vacations
--
-- Повна schema — застосована до Supabase. Цей файл як референс.
-- Для повного відтворення: див. DreamCar HQ як шаблон: github.com/dreamcarua/dreamcar-team/blob/main/hq/db/schema.sql
