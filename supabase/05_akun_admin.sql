-- =========================================================
-- MODUL: KELOLA AKUN (ADMIN)
-- Jalankan file ini di Supabase SQL Editor SETELAH 01_schema.sql.
-- Membuat tabel profiles (role per akun login) + RLS + trigger auto-provision.
-- =========================================================

-- =========================================================
-- 1. TABEL PROFILES
-- Satu baris per akun Supabase Auth (auth.users), menyimpan nama & role aplikasi.
-- =========================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text,
  email text,
  role text not null default 'User' check (role in ('Admin','User')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();

-- =========================================================
-- 2. AUTO-PROVISION PROFILE SAAT ADA USER BARU
-- Setiap kali ada akun baru dibuat lewat Supabase Auth (Dashboard atau Edge
-- Function admin-users), otomatis dibuatkan baris profiles dengan role 'User'.
-- =========================================================

create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into profiles (id, nama, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'User')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function handle_new_auth_user();

-- Backfill: buatkan profile utk akun yang sudah ada duluan sebelum migrasi ini.
insert into profiles (id, nama, email, role)
select u.id, split_part(u.email,'@',1), u.email, 'User'
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

-- =========================================================
-- 3. HELPER: cek apakah user yang sedang login adalah Admin
-- security definer supaya tidak bentrok dgn RLS saat dipakai di policy.
-- =========================================================

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'Admin'
  );
$$ language sql security definer stable set search_path = public;

-- =========================================================
-- 4. ROW LEVEL SECURITY - profiles
-- - Semua user login boleh baca semua profile (dipakai utk dropdown/label role)
-- - Insert/Update/Delete HANYA boleh oleh Admin (perubahan akun tetap lewat
--   Edge Function admin-users, tabel ini biasanya diubah oleh trigger di atas,
--   tapi policy tetap dijaga ketat di sisi database).
-- =========================================================

alter table profiles enable row level security;

drop policy if exists "read all - profiles" on profiles;
create policy "read all - profiles" on profiles
for select using (auth.role() = 'authenticated');

drop policy if exists "admin insert - profiles" on profiles;
create policy "admin insert - profiles" on profiles
for insert with check (is_admin());

drop policy if exists "admin update - profiles" on profiles;
create policy "admin update - profiles" on profiles
for update using (is_admin()) with check (is_admin());

drop policy if exists "admin delete - profiles" on profiles;
create policy "admin delete - profiles" on profiles
for delete using (is_admin());

-- =========================================================
-- 5. JADIKAN AKUN PERTAMA SEBAGAI ADMIN (WAJIB DIJALANKAN MANUAL)
-- Ganti email di bawah dengan email akun yang mau kamu jadikan Super Admin
-- pertama (harus akun yang SUDAH ada di Authentication > Users), lalu jalankan
-- baris ini SENDIRI di SQL Editor. Setelah itu, penambahan admin lain bisa
-- dilakukan lewat halaman "Kelola Akun" di aplikasi.
-- =========================================================

-- update profiles set role = 'Admin' where email = 'admin@perusahaan.com';
