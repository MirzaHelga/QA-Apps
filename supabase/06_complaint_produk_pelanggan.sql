-- =========================================================
-- MIGRASI: Complaint -> berbasis Produk & Pelanggan
-- Jalankan file ini kalau tabel `complaints` sudah pernah dibuat
-- dengan skema lama (area_id / mesin_id / equipment_id / pelapor_id karyawan).
--
-- Perubahan:
--   - Hapus kolom: shift, area_id, mesin_id, equipment_id, pelapor_id
--   - Tambah kolom: sumber_complaint, produk_nama, kode_batch,
--     tanggal_produksi, tanggal_kadaluarsa,
--     pelapor_nama, pelapor_kontak, pelapor_asal
-- =========================================================

-- 1. Tambah kolom baru dulu (nullable/default agar aman untuk data lama)
alter table complaints add column if not exists sumber_complaint text;
alter table complaints add column if not exists produk_nama text;
alter table complaints add column if not exists kode_batch text;
alter table complaints add column if not exists tanggal_produksi date;
alter table complaints add column if not exists tanggal_kadaluarsa date;
alter table complaints add column if not exists pelapor_nama text;
alter table complaints add column if not exists pelapor_kontak text;
alter table complaints add column if not exists pelapor_asal text;

-- 2. Isi nilai default untuk baris lama yang sudah ada, supaya not-null bisa dipasang
update complaints set sumber_complaint = 'Lainnya' where sumber_complaint is null;
update complaints set produk_nama = '(data lama - belum diisi)' where produk_nama is null;
update complaints set pelapor_nama = '(data lama - belum diisi)' where pelapor_nama is null;

-- 3. Pasang constraint not-null setelah data lama terisi
alter table complaints alter column sumber_complaint set default 'Email';
alter table complaints alter column sumber_complaint set not null;
alter table complaints alter column produk_nama set not null;
alter table complaints alter column pelapor_nama set not null;

-- 4. Hapus index lama yang mengacu ke area_id, lalu hapus kolom-kolom lama
drop index if exists idx_complaints_area;

alter table complaints drop column if exists shift;
alter table complaints drop column if exists area_id;
alter table complaints drop column if exists mesin_id;
alter table complaints drop column if exists equipment_id;
alter table complaints drop column if exists pelapor_id;

-- 5. Index baru
create index if not exists idx_complaints_sumber on complaints(sumber_complaint);
