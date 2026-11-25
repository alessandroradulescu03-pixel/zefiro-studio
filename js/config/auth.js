/**
 * Accesso al gestionale (Supabase Auth del progetto "zefiro").
 * --------------------------------------------------------------
 * url  → Supabase → Project Settings → API → Project URL
 * key  → Supabase → Project Settings → API Keys → chiave "publishable"
 *        (o "anon public"). È pubblica per natura: può stare qui.
 *        La chiave "secret" / "service_role" NON va mai messa in questi file.
 * allowed → email che possono entrare. Gli utenti li crei tu in
 *        Supabase → Authentication → Users → Add user.
 */
export const AUTH = {
  url: 'https://wqpblitzpxmayeucvasd.supabase.co',
  key: '',
  allowed: ['alessandro.radulescu03@gmail.com', 'zefiro.webagency@gmail.com'],
};
