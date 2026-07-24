-- =========================================================
-- Migrasi: dukung banyak foto per Complaint & Report QC
-- (sebelumnya cuma 1 foto per baris lewat kolom photo_url)
-- =========================================================
-- Jalankan ini di SQL Editor Supabase kamu.

alter table complaints
  add column if not exists photo_urls text[] not null default '{}';

alter table qc_reports
  add column if not exists photo_urls text[] not null default '{}';

-- Kolom lama (photo_url, 1 foto) sudah tidak dipakai oleh aplikasi
-- lagi mulai sekarang — aman dihapus.
alter table complaints drop column if exists photo_url;
alter table qc_reports drop column if exists photo_url;
