# QA Quality System

Aplikasi web Quality Assurance — **Dashboard**, **Complaint**, dan **Report QC** —
dibangun dengan **HTML + JavaScript murni (vanilla)** dan **Supabase (Postgres + Auth + Storage)** sebagai backend.

Tema warna: **White + Teal** (modern), lengkap dengan sidebar hamburger dan logo kosongan yang bisa kamu ganti sendiri.

---

## 1. Struktur folder

```
qa-app/
├── index.html          # Halaman Dashboard
├── complaint.html       # Halaman Complaint
├── report.html          # Halaman Report QC
├── login.html            # Halaman login (Supabase Auth)
├── css/
│   └── style.css        # Tema White + Teal
├── js/
│   ├── config.js         # Isi URL & Anon Key Supabase kamu di sini
│   ├── utils.js           # Helper umum (toast, format tanggal, upload foto, dst)
│   ├── layout.js          # Sidebar + topbar (hamburger)
│   ├── dashboard.js
│   ├── complaint.js
│   └── report.js
├── assets/
│   └── logo-placeholder.svg   # Logo kosongan, tinggal ganti
└── supabase/
    ├── 01_schema.sql              # Struktur tabel, RLS, storage bucket
    └── 02_seed_master_data.sql    # Data master Area/Mesin/Equipment/Karyawan
                                     # (auto-generated dari Karyawan.xlsx & Mesin.xlsx kamu)
```

---

## 2. Setup Supabase (sekali saja)

1. Buat project baru di https://supabase.com/dashboard.
2. Buka **SQL Editor**, jalankan isi file `supabase/01_schema.sql` — ini akan membuat:
   - Tabel master: `master_area`, `master_mesin`, `master_equipment`, `master_karyawan`
   - Tabel transaksi: `complaints`, `qc_reports`
   - Row Level Security (RLS) + storage bucket `qa-photos` untuk foto
3. Jalankan `supabase/02_seed_master_data.sql` — ini akan mengisi:
   - **9 Area**, **103 kombinasi Area-Mesin**, **586 kombinasi Mesin-Equipment** (dari `Mesin.xlsx`)
   - **223 data Karyawan** (dari `Karyawan.xlsx`) — NIK, Nama, Departemen, Status, Gender, Grup (L1/L2/L3), Role
4. Buka **Authentication > Users**, klik **Add user** untuk membuat akun login QA (email + password). RLS dibuat agar hanya user yang login (authenticated) yang bisa menambah/mengubah data — data tetap bisa dibaca publik (silakan perketat sesuai kebutuhan).
5. Pastikan bucket **qa-photos** muncul di menu **Storage** (dibuat otomatis oleh schema). Kalau tidak muncul, buat manual: nama `qa-photos`, set **Public bucket** = ON.

---

## 3. Hubungkan aplikasi ke Supabase kamu

Buka `js/config.js`, ganti dua baris ini dengan punya kamu (Project Settings > API):

```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

---

## 4. Menjalankan aplikasi

Karena ini murni HTML/JS statis, kamu tinggal:

- **Cara termudah:** buka folder ini di VS Code, install extension **Live Server**, klik kanan `login.html` → *Open with Live Server*.
- **Atau:** jalankan `npx serve .` di terminal dari dalam folder `qa-app/`.
- **Atau:** upload semua file ke hosting statis apa pun (Netlify, Vercel, GitHub Pages, cPanel, dsb).

> ⚠️ Jangan dibuka langsung lewat `file://` karena beberapa fitur (fetch, modul) butuh server HTTP.

---

## 5. Fitur yang tersedia

**Dashboard**
- Kartu statistik: total complaint, complaint open, total report QC, QC pass rate 30 hari terakhir
- Grafik tren complaint vs report QC 14 hari terakhir
- Grafik status complaint, complaint per area, hasil QC (pass/fail)
- Tabel complaint & report QC terbaru

**Complaint**
- Tambah/edit/hapus complaint lengkap dengan: tanggal, shift, Area → Mesin → Equipment (dropdown berjenjang), pelapor (dari master karyawan), kategori, tingkat keparahan (severity), deskripsi, tindakan perbaikan, status, dan **upload foto bukti**
- Filter berdasarkan status, severity, area, dan pencarian teks
- Nomor complaint otomatis (format `CMP-2026-0001`, dst)

**Report QC**
- Tambah/edit/hapus report QC dengan: tanggal, shift, Area → Mesin → Equipment, inspector, parameter QC, standar/acuan, hasil aktual, hasil (Pass/Fail), catatan, dan **upload foto**
- Filter berdasarkan hasil, area, dan pencarian teks
- Nomor report otomatis (format `QC-2026-0001`, dst)

**Umum**
- Sidebar dengan tombol **hamburger** (collapsible, responsive untuk mobile)
- Logo kosongan di sidebar & halaman login — klik dan simpan logo kamu sendiri lewat kode (`localStorage.setItem('qa_logo', 'data:image/png;base64,...')`) atau ganti langsung file `assets/logo-placeholder.svg`
- Login menggunakan Supabase Auth (email/password)
- Tema **White + Teal**, rapi dan modern, responsif di desktop & mobile

---

## 6. Menambah logo perusahaan

Cara paling gampang: ganti isi file `assets/logo-placeholder.svg` dengan logo kamu (boleh format `.svg`, `.png`, atau `.jpg` — tinggal sesuaikan nama file di `js/layout.js` dan `login.html`, cari `logo-placeholder.svg`).

---

## 7. Kustomisasi lanjutan

- **Warna tema**: semua warna diatur lewat CSS variable di `css/style.css` bagian `:root` (`--teal-700`, dst) — tinggal ganti nilainya.
- **Kategori complaint / parameter QC**: edit langsung di `complaint.html` dan `report.html` pada bagian `<select>`.
- **Keamanan (RLS)**: policy di `01_schema.sql` saat ini mengizinkan semua user yang login (authenticated) untuk insert/update/delete. Kalau butuh role-based (misal hanya QA yang boleh ubah status), perketat policy tersebut sesuai kebutuhan.
