/* =========================================================
   KONFIGURASI SUPABASE
   Ganti dua nilai di bawah ini dengan milik project Supabase kamu.
   Ambil dari: Supabase Dashboard > Project Settings > API
========================================================= */

const SUPABASE_URL = 'https://pcnrkvxaujutsfytbtrf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbnJrdnhhdWp1dHNmeXRidHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNjg2MjAsImV4cCI6MjA5OTc0NDYyMH0.xiGmUxRph5qVTjJxRRpGXbJte36XMh2NMgP-qJgBPy8';

// Nama bucket storage untuk foto (dibuat otomatis oleh 01_schema.sql)
const PHOTO_BUCKET = 'qa-photos';

// Inisialisasi client (butuh CDN supabase-js yang di-load sebelum file ini)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
