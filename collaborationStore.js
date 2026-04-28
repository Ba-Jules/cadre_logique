const LS_KEY = "cadre_logique_contributions";
const SESSION_KEY = "cadre_logique_session";

export function generateSessionId() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) { id = generateSessionId(); localStorage.setItem(SESSION_KEY, id); }
  return id;
}

export function resetSession() {
  const id = generateSessionId();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

function readAll() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function writeAll(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export function getContributions(sessionId) {
  const all = readAll();
  return sessionId ? all.filter(c => c.sessionId === sessionId) : all;
}

export function saveContribution({ sessionId, type, target, text }) {
  const contribution = {
    id: Math.random().toString(36).slice(2, 10),
    sessionId,
    type,
    target,
    text: text.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  writeAll([...readAll(), contribution]);
  return contribution;
}

export function updateContribution(id, patch) {
  writeAll(readAll().map(c => c.id === id ? { ...c, ...patch } : c));
}

export function removeContribution(id) {
  writeAll(readAll().filter(c => c.id !== id));
}
