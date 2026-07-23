-- =========================================================
-- VERIFIKASI QUALITY (After CIP & Start Up)
-- Jalankan file ini di Supabase SQL Editor SETELAH 01_schema.sql
-- (dan setelah 02_seed_master_data.sql / 03_fix_grants.sql jika sudah dipakai)
-- =========================================================

create extension if not exists "pgcrypto";

do $$ begin
  create type vq_tipe as enum ('After CIP','Start Up');
exception when duplicate_object then null; end $$;

create sequence if not exists vq_no_seq start 1;

create table if not exists verifikasi_quality (
  id uuid primary key default gen_random_uuid(),
  no text unique not null default ('VQ-' || to_char(now(),'YYYY') || '-' || lpad(nextval('vq_no_seq')::text,4,'0')),
  tipe vq_tipe not null,                     -- 'After CIP' atau 'Start Up'
  tanggal date not null default current_date,
  shift text,                                -- 1 / 2 / 3
  line text,                                 -- mis. "Line 1", "1,2,3,4,5"
  per_line boolean default false,
  items jsonb not null default '[]'::jsonb,  -- [{pengecekan, standard, hasil, status}]
  flm_id uuid references master_karyawan(id),
  qa_id uuid references master_karyawan(id),
  catatan text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_vq_tanggal on verifikasi_quality(tanggal);
create index if not exists idx_vq_tipe on verifikasi_quality(tipe);

drop trigger if exists trg_vq_updated_at on verifikasi_quality;
create trigger trg_vq_updated_at
before update on verifikasi_quality
for each row execute function set_updated_at();

alter table verifikasi_quality enable row level security;

drop policy if exists "read all - vq" on verifikasi_quality;
create policy "read all - vq" on verifikasi_quality for select using (true);
drop policy if exists "write auth - vq" on verifikasi_quality;
create policy "write auth - vq" on verifikasi_quality for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
