// =========================================================
// EDGE FUNCTION: admin-users
// =========================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Tidak ada sesi login.' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user: caller }, error: callerErr } = await asCaller.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Sesi tidak valid, silakan login ulang.' }, 401);

    const { data: callerProfile, error: callerProfileErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();

    if (callerProfileErr) {
      return json({ error: 'Gagal cek profile admin: ' + callerProfileErr.message }, 500);
    }

    if (!callerProfile) {
      return json({ error: `Profile tidak ditemukan untuk user id ${caller.id} (email: ${caller.email}). Pastikan baris ini ada di tabel profiles.` }, 403);
    }

    if (callerProfile.role !== 'Admin') {
      return json({ error: `Role kamu saat ini "${callerProfile.role}", bukan Admin.` }, 403);
    }

    const { action, payload } = await req.json();

    if (action === 'list') {
      const { data: usersRes, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) throw listErr;

      const { data: profiles, error: profErr } = await admin.from('profiles').select('*');
      if (profErr) throw profErr;

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const rows = usersRes.users.map((u) => ({
        id: u.id,
        email: u.email,
        nama: profileMap.get(u.id)?.nama || u.email?.split('@')[0] || '-',
        role: profileMap.get(u.id)?.role || 'User',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
      })).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      return json({ data: rows });
    }

    if (action === 'create') {
      const { email, password, nama, role } = payload || {};
      if (!email || !password || password.length < 6) {
        return json({ error: 'Email wajib diisi & password minimal 6 karakter.' }, 400);
      }
      const finalRole = role === 'Admin' ? 'Admin' : 'User';

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nama: nama || email.split('@')[0], role: finalRole },
      });
      if (createErr) return json({ error: createErr.message }, 400);

      await admin.from('profiles').upsert({
        id: created.user!.id,
        email,
        nama: nama || email.split('@')[0],
        role: finalRole,
      });

      return json({ data: { id: created.user!.id } });
    }

    if (action === 'update') {
      const { id, nama, role, email, password } = payload || {};
      if (!id) return json({ error: 'ID akun tidak ada.' }, 400);

      if (id === caller.id && role && role !== 'Admin') {
        const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'Admin');
        if ((count || 0) <= 1) return json({ error: 'Tidak bisa menurunkan role Admin terakhir.' }, 400);
      }

      const authUpdate: Record<string, unknown> = {};
      if (email) authUpdate.email = email;
      if (password) {
        if (password.length < 6) return json({ error: 'Password minimal 6 karakter.' }, 400);
        authUpdate.password = password;
      }
      if (Object.keys(authUpdate).length) {
        const { error: updErr } = await admin.auth.admin.updateUserById(id, authUpdate);
        if (updErr) return json({ error: updErr.message }, 400);
      }

      const profileUpdate: Record<string, unknown> = {};
      if (nama !== undefined) profileUpdate.nama = nama;
      if (role !== undefined) profileUpdate.role = role === 'Admin' ? 'Admin' : 'User';
      if (email !== undefined) profileUpdate.email = email;
      if (Object.keys(profileUpdate).length) {
        const { error: profUpdErr } = await admin.from('profiles').update(profileUpdate).eq('id', id);
        if (profUpdErr) return json({ error: profUpdErr.message }, 400);
      }

      return json({ data: { id } });
    }

    if (action === 'delete') {
      const { id } = payload || {};
      if (!id) return json({ error: 'ID akun tidak ada.' }, 400);
      if (id === caller.id) return json({ error: 'Tidak bisa menghapus akun sendiri.' }, 400);

      const { data: targetProfile } = await admin.from('profiles').select('role').eq('id', id).maybeSingle();
      if (targetProfile?.role === 'Admin') {
        const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'Admin');
        if ((count || 0) <= 1) return json({ error: 'Tidak bisa menghapus Admin terakhir.' }, 400);
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(id);
      if (delErr) return json({ error: delErr.message }, 400);

      return json({ data: { id } });
    }

    if (action === 'setBanned') {
      const { id, banned } = payload || {};
      if (!id) return json({ error: 'ID akun tidak ada.' }, 400);
      if (id === caller.id) return json({ error: 'Tidak bisa menonaktifkan akun sendiri.' }, 400);

      const { error: banErr } = await admin.auth.admin.updateUserById(id, {
        ban_duration: banned ? '876000h' : 'none',
      });
      if (banErr) return json({ error: banErr.message }, 400);

      return json({ data: { id, banned } });
    }

    return json({ error: 'Aksi tidak dikenal.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Terjadi kesalahan server.' }, 500);
  }
});
