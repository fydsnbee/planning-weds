// Cloudflare Pages Function: simpan data planner di KV, dilindungi kata sandi bersama.
// Butuh: binding KV bernama PLANNER_KV dan secret bernama PLANNER_PASSWORD.
const enc = new TextEncoder();
const hash = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function sama(a, b) {
  const x = await hash(a), y = await hash(b);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
const J = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function onRequest({ request, env }) {
  if (!env.PLANNER_PASSWORD || !env.PLANNER_KV) return J({ error: 'konfigurasi belum lengkap' }, 500);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!(await sama(token, env.PLANNER_PASSWORD))) return J({ error: 'auth' }, 401);

  const cur = JSON.parse((await env.PLANNER_KV.get('planner')) || '{"rev":0,"data":null}');
  if (request.method === 'GET') return J(cur);

  if (request.method === 'PUT') {
    let b;
    try { b = await request.json(); } catch (e) { return J({ error: 'bad' }, 400); }
    if (!b || typeof b.data !== 'object' || b.data === null || typeof b.rev !== 'number') return J({ error: 'bad' }, 400);
    if (b.rev < cur.rev) return J({ error: 'conflict', rev: cur.rev }, 409);
    const next = { rev: Math.max(cur.rev, b.rev) + 1, data: b.data };
    const s = JSON.stringify(next);
    if (s.length > 5e6) return J({ error: 'terlalu besar' }, 413);
    await env.PLANNER_KV.put('planner', s);
    return J({ rev: next.rev });
  }
  return J({ error: 'method' }, 405);
}
