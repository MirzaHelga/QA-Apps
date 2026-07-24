-- =========================================================
-- MIGRASI: Tambah field Operator di Verifikasi Quality
-- Jalankan file ini di Supabase SQL Editor SETELAH 08_verifikasi_approval_roles.sql
-- =========================================================

alter table verifikasi_quality
  add column if not exists operator_id uuid references master_karyawan(id);
