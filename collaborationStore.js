// Contributions partagées entre participants à distance.
// Stockage : base Promo99 Suite (Supabase), accessible uniquement par des fonctions contrôlées :
// un participant peut seulement soumettre ; le modérateur (qui détient le jeton de la session,
// gardé dans son navigateur) lit, valide, rejette ou supprime.
// L'interface reste synchrone pour l'application : getContributions() renvoie le cache local,
// rafraîchi en arrière-plan ; subscribe() prévient les écrans quand il change.

const API = "https://promo99diaspora.org/ndaje-api/rest/v1/rpc/";
// Clé publique « anon » (non secrète : c'est la même que celle des pages publiques de la Promo99 Suite).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgzNzc5NTk0LCJleHAiOjIwOTkxMzk1OTR9.MS1Ig3z1_6NbFIsEybuIF55pPQ7XPOWPEO7ACO2FFrY";

const SESSION_KEY = "cadre_logique_session";
const TOKEN_PREFIX = "cadre_logique_token_";

let cache = { sessionId: null, items: [], loadedAt: 0, error: null };
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getSyncError() { return cache.error; }

async function rpc(name, body) {
  const r = await fetch(API + name, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  const data = txt ? JSON.parse(txt) : null;
  if (!r.ok) throw new Error((data && data.message) || `Erreur ${r.status}`);
  return data;
}

export function generateSessionId() {
  return Math.random().toString(36).slice(2, 10).toUpperCase().replace(/[^A-Z0-9]/g, "X").padEnd(8, "X");
}

function tokenFor(sessionId) { return localStorage.getItem(TOKEN_PREFIX + sessionId); }

// Enregistre la session côté serveur ; le premier navigateur qui le fait (le modérateur) reçoit le jeton.
export async function ensureModeratorSession(sessionId) {
  if (tokenFor(sessionId)) return true;
  try {
    const token = await rpc("cadre_creer_session", { p_session: sessionId });
    if (token) { localStorage.setItem(TOKEN_PREFIX + sessionId, token); return true; }
    return false; // session déjà ouverte ailleurs : ce navigateur n'en est pas le modérateur
  } catch (e) { cache.error = e.message; notify(); return false; }
}

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) { id = generateSessionId(); localStorage.setItem(SESSION_KEY, id); }
  return id;
}

export function resetSession() {
  const id = generateSessionId();
  localStorage.setItem(SESSION_KEY, id);
  cache = { sessionId: id, items: [], loadedAt: 0, error: null };
  ensureModeratorSession(id);
  notify();
  return id;
}

async function refresh(sessionId) {
  const token = tokenFor(sessionId);
  if (!token) { await ensureModeratorSession(sessionId); if (!tokenFor(sessionId)) return; }
  try {
    const rows = await rpc("cadre_lister", { p_session: sessionId, p_token: tokenFor(sessionId) });
    cache = {
      sessionId, loadedAt: Date.now(), error: null,
      items: (rows || []).map(r => ({ id: r.id, sessionId, type: r.type, target: r.target, text: r.text, status: r.status, createdAt: r.created_at })),
    };
  } catch (e) { cache.error = e.message; }
  notify();
}

// Synchrone : renvoie le cache et lance un rafraîchissement si le cache a plus de 3 secondes.
export function getContributions(sessionId) {
  if (cache.sessionId !== sessionId) cache = { sessionId, items: [], loadedAt: 0, error: null };
  if (Date.now() - cache.loadedAt > 3000) { cache.loadedAt = Date.now(); refresh(sessionId); }
  return cache.items;
}

// Participant : envoi vers la session du modérateur.
export async function saveContribution({ sessionId, type, target, text }) {
  const id = await rpc("cadre_contribuer", { p_session: sessionId, p_type: type, p_target: target || "", p_text: text.trim() });
  return { id, sessionId, type, target, text: text.trim(), status: "pending", createdAt: new Date().toISOString() };
}

export function updateContribution(id, patch) {
  cache.items = cache.items.map(c => c.id === id ? { ...c, ...patch } : c); notify();
  if (patch.status) rpc("cadre_statut", { p_session: cache.sessionId, p_token: tokenFor(cache.sessionId), p_id: id, p_status: patch.status })
    .catch(e => { cache.error = e.message; notify(); });
}

export function removeContribution(id) {
  cache.items = cache.items.filter(c => c.id !== id); notify();
  rpc("cadre_supprimer", { p_session: cache.sessionId, p_token: tokenFor(cache.sessionId), p_id: id })
    .catch(e => { cache.error = e.message; notify(); });
}
