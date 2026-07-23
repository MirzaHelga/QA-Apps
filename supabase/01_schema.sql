-- =========================================================
-- QA APP - SUPABASE (POSTGRES) SCHEMA
-- Jalankan file ini di Supabase SQL Editor SEBELUM 02_seed_master_data.sql
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. MASTER DATA
-- =========================================================

-- Master Area
create table if not exists master_area (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);

-- Master Mesin (per Area)
create table if not exists master_mesin (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references master_area(id) on delete cascade,
  nama text not null,
  created_at timestamptz default now(),
  unique (area_id, nama)
);

-- Master Equipment (per Mesin)
create table if not exists master_equipment (
  id uuid primary key default gen_random_uuid(),
  mesin_id uuid not null references master_mesin(id) on delete cascade,
  nama text not null,
  created_at timestamptz default now(),
  unique (mesin_id, nama)
);

-- Master Karyawan
create table if not exists master_karyawan (
  id uuid primary key default gen_random_uuid(),
  nik text not null unique,
  nama text not null,
  departemen text,
  status text default 'Active',
  gender text,
  grup text,              -- L1 / L2 / L3
  role text default 'Basic', -- Basic / Super Admin
  created_at timestamptz default now()
);

-- =========================================================
-- 2. ENUM TYPES
-- =========================================================

do $$ begin
  create type complaint_status as enum ('Open','In Progress','Closed','Rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type complaint_severity as enum ('Low','Medium','High','Critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type qc_result as enum ('Pass','Fail');
exception when duplicate_object then null; end $$;

-- =========================================================
-- 3. COMPLAINT
-- =========================================================

create sequence if not exists complaint_no_seq start 1;

create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_no text unique not null default ('CMP-' || to_char(now(),'YYYY') || '-' || lpad(nextval('complaint_no_seq')::text,4,'0')),
  tanggal date not null default current_date,
  shift text,                              -- Shift 1 / 2 / 3
  area_id uuid references master_area(id),
  mesin_id uuid references master_mesin(id),
  equipment_id uuid references master_equipment(id),
  pelapor_id uuid references master_karyawan(id),
  kategori text,                           -- Foreign Material, Packaging, Process, dll
  severity complaint_severity not null default 'Medium',
  deskripsi text not null,
  tindakan_perbaikan text,
  status complaint_status not null default 'Open',
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_complaints_tanggal on complaints(tanggal);
create index if not exists idx_complaints_area on complaints(area_id);
create index if not exists idx_complaints_status on complaints(status);

-- =========================================================
-- 4. REPORT QC
-- =========================================================

create sequence if not exists qc_no_seq start 1;

create table if not exists qc_reports (
  id uuid primary key default gen_random_uuid(),
  report_no text unique not null default ('QC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('qc_no_seq')::text,4,'0')),
  tanggal date not null default current_date,
  shift text,
  area_id uuid references master_area(id),
  mesin_id uuid references master_mesin(id),
  equipment_id uuid references master_equipment(id),
  inspector_id uuid references master_karyawan(id),
  parameter text not null,          -- parameter QC yang diperiksa
  standar text,                     -- standar/acuan
  hasil_aktual text,                -- hasil aktual pengukuran
  hasil qc_result not null default 'Pass',
  catatan text,
  photo_url text,
  created_at timestamptz default now()
);

create index if not exists idx_qc_tanggal on qc_reports(tanggal);
create index if not exists idx_qc_area on qc_reports(area_id);
create index if not exists idx_qc_hasil on qc_reports(hasil);

-- =========================================================
-- 5. TRIGGER updated_at utk complaints
-- =========================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_complaints_updated_at on complaints;
create trigger trg_complaints_updated_at
before update on complaints
for each row execute function set_updated_at();

-- =========================================================
-- 6. ROW LEVEL SECURITY
-- Demo: akses penuh untuk role 'authenticated'. Perketat sesuai kebutuhan
-- (mis. batasi INSERT/UPDATE/DELETE per role) sebelum go-live.
-- =========================================================

alter table master_area enable row level security;
alter table master_mesin enable row level security;
alter table master_equipment enable row level security;
alter table master_karyawan enable row level security;
alter table complaints enable row level security;
alter table qc_reports enable row level security;

drop policy if exists "read all - area" on master_area;
create policy "read all - area" on master_area for select using (true);
drop policy if exists "write auth - area" on master_area;
create policy "write auth - area" on master_area for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "read all - mesin" on master_mesin;
create policy "read all - mesin" on master_mesin for select using (true);
drop policy if exists "write auth - mesin" on master_mesin;
create policy "write auth - mesin" on master_mesin for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "read all - equipment" on master_equipment;
create policy "read all - equipment" on master_equipment for select using (true);
drop policy if exists "write auth - equipment" on master_equipment;
create policy "write auth - equipment" on master_equipment for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "read all - karyawan" on master_karyawan;
create policy "read all - karyawan" on master_karyawan for select using (true);
drop policy if exists "write auth - karyawan" on master_karyawan;
create policy "write auth - karyawan" on master_karyawan for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "read all - complaints" on complaints;
create policy "read all - complaints" on complaints for select using (true);
drop policy if exists "write auth - complaints" on complaints;
create policy "write auth - complaints" on complaints for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "read all - qc" on qc_reports;
create policy "read all - qc" on qc_reports for select using (true);
drop policy if exists "write auth - qc" on qc_reports;
create policy "write auth - qc" on qc_reports for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =========================================================
-- 7. STORAGE BUCKET (jalankan lewat Studio > Storage jika ini gagal,
-- atau lewat SQL editor - butuh extension storage yang sudah aktif di Supabase)
-- =========================================================

insert into storage.buckets (id, name, public)
values ('qa-photos','qa-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read qa-photos" on storage.objects;
create policy "public read qa-photos" on storage.objects
for select using (bucket_id = 'qa-photos');

drop policy if exists "auth upload qa-photos" on storage.objects;
create policy "auth upload qa-photos" on storage.objects
for insert with check (bucket_id = 'qa-photos' and auth.role() = 'authenticated');
