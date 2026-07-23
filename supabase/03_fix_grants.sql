-- =========================================================
-- FIX: "permission denied for table ..."
-- Jalankan file ini SEKALI di Supabase SQL Editor kalau kamu
-- menemukan error "permission denied for table complaints"
-- (atau tabel lain) saat memuat data di aplikasi.
--
-- Penyebab: RLS policy sudah benar, tapi role anon/authenticated
-- belum punya GRANT dasar ke tabel — ini beda dari RLS.
-- =========================================================

-- Beri akses ke semua tabel yang SUDAH ada di schema public
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
on all tables in schema public
to anon, authenticated;

grant usage, select
on all sequences in schema public
to anon, authenticated;

-- Supaya tabel yang dibuat BELAKANGAN juga otomatis dapat grant ini
alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated;
