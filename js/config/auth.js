/**
 * Accesso al gestionale (Supabase Auth del progetto "zefiro-gestionale").
 * --------------------------------------------------------------
 * url  → Supabase → Project Settings → API → Project URL
 * key  → Supabase → Project Settings → API Keys → chiave "publishable"
 *        (o "anon public"). È pubblica per natura: può stare qui.
 *        La chiave "secret" / "service_role" NON va mai messa in questi file.
 * allowed → email che possono entrare. Gli utenti li crei tu in
 *        Supabase → Authentication → Users → Add user.
 */
export const AUTH = {
  url: 'https://lguktbqwsplabptuvmgu.supabase.co',
  key: 'sb_publishable_pOL8IQb0Nq2wXcRLVaUt8g_8miAPlI2',
  allowed: ['alessandro.radulescu03@gmail.com', 'zefiro.webagency@gmail.com'],
};
