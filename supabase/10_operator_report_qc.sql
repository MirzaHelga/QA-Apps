-- =========================================================
-- MIGRASI: Operator bisa submit Report QC (bukan cuma Verifikasi Quality)
-- Jalankan file ini di Supabase SQL Editor SETELAH 08_verifikasi_approval_roles.sql
-- =========================================================

-- Catat siapa yang input report (dipakai buat batasi Operator cuma lihat
-- report miliknya sendiri, sama seperti Verifikasi Quality).
alter table qc_reports
  add column if not exists created_by uuid references profiles(id);

create index if not exists idx_qc_created_by on qc_reports(created_by);

-- Perketat RLS: semua role login boleh baca & insert (termasuk Operator),
-- tapi UPDATE/DELETE hanya Admin & Spv.
drop policy if exists "write auth - qc" on qc_reports;

drop policy if exists "select - qc" on qc_reports;
create policy "select - qc" on qc_reports
for select using (auth.role() = 'authenticated');

drop policy if exists "insert - qc" on qc_reports;
create policy "insert - qc" on qc_reports
for insert with check (auth.role() = 'authenticated');

drop policy if exists "update - qc" on qc_reports;
create policy "update - qc" on qc_reports
for update using (is_spv_or_admin()) with check (is_spv_or_admin());

drop policy if exists "delete - qc" on qc_reports;
create policy "delete - qc" on qc_reports
for delete using (is_spv_or_admin());
