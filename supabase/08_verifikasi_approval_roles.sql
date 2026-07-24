-- =========================================================
-- MIGRASI: Multi-foto + Approval Verifikasi Quality + Role Spv/Operator
-- Jalankan file ini di Supabase SQL Editor SETELAH 04_verifikasi_quality.sql
-- dan 05_akun_admin.sql.
-- =========================================================

-- =========================================================
-- 1. VERIFIKASI QUALITY: foto (banyak) + status approval
-- =========================================================

alter table verifikasi_quality
  add column if not exists photo_urls text[] not null default '{}';

do $$ begin
  create type vq_approval_status as enum ('Menunggu Approval','Approved','Ditolak');
exception when duplicate_object then null; end $$;

alter table verifikasi_quality
  add column if not exists approval_status vq_approval_status not null default 'Menunggu Approval';

alter table verifikasi_quality
  add column if not exists approved_by uuid references profiles(id);

alter table verifikasi_quality
  add column if not exists approved_at timestamptz;

alter table verifikasi_quality
  add column if not exists catatan_approval text;

alter table verifikasi_quality
  add column if not exists created_by uuid references profiles(id);

create index if not exists idx_vq_approval_status on verifikasi_quality(approval_status);
create index if not exists idx_vq_created_by on verifikasi_quality(created_by);

-- =========================================================
-- 2. ROLE BARU: Spv & Operator
-- profiles.role sebelumnya hanya 'Admin' / 'User'. Tambah 'Spv' & 'Operator'.
-- =========================================================

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('Admin','User','Spv','Operator'));

-- Helper: role akun yang sedang login (security definer supaya aman dipakai di policy)
create or replace function current_app_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable set search_path = public;

create or replace function is_spv_or_admin()
returns boolean as $$
  select current_app_role() in ('Admin','Spv');
$$ language sql security definer stable set search_path = public;

-- =========================================================
-- 3. RLS verifikasi_quality per role
-- - SELECT: semua user login boleh baca (dipakai utk daftar & detail;
--   pembatasan tampilan utk Operator "cuma bisa input" diatur di sisi UI).
-- - INSERT: semua user login boleh input (Operator, Spv, Admin, User).
-- - UPDATE/DELETE: hanya Admin & Spv (termasuk aksi Approve/Tolak).
-- =========================================================

drop policy if exists "write auth - vq" on verifikasi_quality;

drop policy if exists "select - vq" on verifikasi_quality;
create policy "select - vq" on verifikasi_quality
for select using (auth.role() = 'authenticated');

drop policy if exists "insert - vq" on verifikasi_quality;
create policy "insert - vq" on verifikasi_quality
for insert with check (auth.role() = 'authenticated');

drop policy if exists "update - vq" on verifikasi_quality;
create policy "update - vq" on verifikasi_quality
for update using (is_spv_or_admin()) with check (is_spv_or_admin());

drop policy if exists "delete - vq" on verifikasi_quality;
create policy "delete - vq" on verifikasi_quality
for delete using (is_spv_or_admin());
