import { useState, useCallback, useRef, useEffect, Fragment } from "react";
import QRCode from "qrcode";

import AiConfigPanel, { loadAIConfig, AI_PROVIDERS } from "./AiConfigPanel.jsx";
import {
  generateLogicalFrameworkSuggestions,
  suggestGlobalObjective, suggestSpecificObjective,
  suggestResults, suggestActivities,
  suggestIndicators, suggestAssumptions,
} from "./aiAssistant.js";
import { parseUploadedFile } from "./documentParser.js";
import {
  getSessionId, resetSession, getContributions, updateContribution,
} from "./collaborationStore.js";
import ModeratorContributionsPanel from "./ModeratorContributionsPanel.jsx";

// ─── PALETTE ───────────────────────────────────────────────────
const C = {
  global:   "#6ee7b7", specific: "#93c5fd", result:   "#c4b5fd",
  activity: "#fcd34d", iov:      "#86efac", source:   "#7dd3fc",
  hyp:      "#fca5a5", warn:     "#f59e0b", ok:       "#22c55e",
  err:      "#f87171", bg:       "#0d1117", surface:  "#1a1f2e",
  border:   "#ffffff14", muted:  "#666",    text:     "#e2e8f0",
};

// ─── STYLES ────────────────────────────────────────────────────
const S = {
  btn: (bg, border, color) => ({
    background: bg, border: `1px solid ${border}`, borderRadius: 8,
    padding: "7px 16px", cursor: "pointer", fontSize: 11, fontWeight: 700, color,
  }),
  cell:  (bg, border) => ({ padding: "10px 12px", background: bg, border: `1px solid ${border}`, verticalAlign: "top", minWidth: 160 }),
  th:    (color) => ({ padding: "10px 14px", background: color + "22", color, fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", border: `1px solid ${color}44`, textAlign: "left", whiteSpace: "nowrap" }),
  input: { width: "100%", background: "#ffffff0a", border: "1px solid #ffffff22", borderRadius: 6, padding: "8px 12px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  label: { color: "#a0aec0", fontSize: 11, marginBottom: 6, display: "block" },
  card:  { background: "#1a1f2e", borderRadius: 12, padding: 24, border: "1px solid #ffffff14", marginBottom: 16 },
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  textarea::placeholder, input::placeholder { color: #555; }
  textarea:focus, input:focus, select:focus { border-color: #6ee7b766 !important; outline: none; }
  button:hover { opacity: 0.85; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #161b28; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
`;

// ─── VALIDATION ────────────────────────────────────────────────
const VAGUE_PATTERNS = [
  /améliorer la situation/i, /résoudre le problème/i,
  /réduire le manque/i, /faire en sorte/i, /^ameliorer$/i, /^résoudre$/i,
];
function validateLabel(label) {
  if (!label || label.trim().length < 10) return { ok: false, msg: "Trop court ou vide" };
  for (const p of VAGUE_PATTERNS) if (p.test(label)) return { ok: false, msg: "Formulation trop vague" };
  return { ok: true, msg: "" };
}

// ─── HELPERS ───────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8);
const emptyEntry    = () => ({ label: "", indicators: [], sources: [], assumptions: [] });
const emptyActivity = () => ({ id: uid(), ...emptyEntry() });
const emptyResult   = () => ({ id: uid(), ...emptyEntry(), activities: [] });

const EMPTY_DATA = { globalObjective: emptyEntry(), specificObjective: emptyEntry(), results: [] };
const EMPTY_META = { name: "", context: "", workshopObjective: "", documents: [] };

// ─── IMPORT STUBS (intégration future pack GAR) ───────────────
export function importFromObjectiveTree(/* treeData */) {
  // TODO: convertir arbre à objectifs → structure cadre logique
  return null;
}
export function importFromStrategy(/* strategyData */) {
  // TODO: convertir sortie AFOM → amorce cadre logique
  return null;
}

// ─── AI SUGGESTION BUTTON ─────────────────────────────────────
function AiBtn({ fn, disabled, title = "Suggestion IA", small }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setErr(""); setLoading(true);
    try { await fn(); } catch (e) { setErr(e.message?.slice(0, 60) || "Erreur IA"); }
    setLoading(false);
  };
  const size = small ? { padding: "2px 8px", fontSize: 10 } : { padding: "5px 12px", fontSize: 11 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <button onClick={go} disabled={loading || disabled} title={title}
        style={{ ...size, background: "#93c5fd22", border: "1px solid #93c5fd44", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "#444" : "#93c5fd", fontWeight: 700, opacity: loading ? 0.6 : 1 }}>
        {loading ? "…" : "✨"}
      </button>
      {err && <span style={{ color: C.err, fontSize: 9 }}>{err}</span>}
    </span>
  );
}

// ─── TAG LIST ──────────────────────────────────────────────────
function TagList({ items, onChange, placeholder, color }) {
  const [draft, setDraft] = useState("");
  const add = () => { if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(""); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
          <span style={{ background: color + "22", color, borderRadius: 4, padding: "3px 8px", fontSize: 11, lineHeight: 1.5, flex: 1, border: `1px solid ${color}44`, wordBreak: "break-word" }}>{item}</span>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 13, padding: "1px 4px", flexShrink: 0 }}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 4 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && add()}
          placeholder={placeholder} style={{ flex: 1, border: `1px dashed ${color}66`, borderRadius: 4, padding: "4px 8px", fontSize: 11, background: "transparent", color: "#ddd", outline: "none" }} />
        <button onClick={add} style={{ background: color + "33", border: `1px solid ${color}66`, borderRadius: 4, padding: "4px 8px", cursor: "pointer", color, fontSize: 11, fontWeight: 700 }}>+</button>
      </div>
    </div>
  );
}

// ─── LABEL EDITOR ──────────────────────────────────────────────
function LabelEditor({ value, onChange, placeholder }) {
  const v = validateLabel(value);
  return (
    <div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ ...S.input, border: "1px solid #ffffff22", resize: "vertical", lineHeight: 1.6 }} />
      {value && !v.ok && <div style={{ color: C.warn, fontSize: 10, marginTop: 2 }}>⚠ {v.msg}</div>}
    </div>
  );
}

// ─── SESSION PANEL ─────────────────────────────────────────────
function SessionPanel({ sessionId, onReset, pendingCount }) {
  const [qrUrl, setQrUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const participantUrl = `${window.location.href.split("?")[0]}?session=${sessionId}&mode=participant`;

  useEffect(() => {
    QRCode.toDataURL(participantUrl, { width: 200, margin: 2, color: { dark: "#e2e8f0", light: "#1a1f2e" } })
      .then(setQrUrl).catch(() => {});
  }, [sessionId]);

  const copy = () => {
    navigator.clipboard.writeText(participantUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ ...S.card, maxWidth: 520, margin: "0 auto" }}>
      <div style={{ color: C.source, fontWeight: 700, fontSize: 13, marginBottom: 16 }}>Session de collaboration</div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        {qrUrl && (
          <div style={{ background: "#1a1f2e", borderRadius: 8, padding: 8, border: "1px solid #ffffff14" }}>
            <img src={qrUrl} alt="QR Code session" style={{ width: 140, height: 140, display: "block" }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ color: "#a0aec0", fontSize: 11, marginBottom: 6 }}>ID de session</div>
          <div style={{ color: C.source, fontWeight: 700, fontSize: 18, letterSpacing: "0.1em", marginBottom: 12 }}>{sessionId}</div>
          <div style={{ color: "#a0aec0", fontSize: 10, marginBottom: 6 }}>Lien participant</div>
          <div style={{ background: "#ffffff08", borderRadius: 6, padding: "6px 10px", fontSize: 9, color: "#888", wordBreak: "break-all", marginBottom: 10 }}>
            {participantUrl}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={copy} style={S.btn(C.source + "22", C.source + "66", C.source)}>
              {copied ? "Copié ✓" : "Copier le lien"}
            </button>
            <button onClick={onReset} style={S.btn("#ffffff09", C.border, C.muted)}>
              Nouvelle session
            </button>
          </div>
          {pendingCount > 0 && (
            <div style={{ marginTop: 12, color: C.warn, fontSize: 11 }}>
              {pendingCount} contribution{pendingCount > 1 ? "s" : ""} en attente de validation
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 16, background: "#ffffff06", borderRadius: 8, padding: 10, fontSize: 10, color: "#444", lineHeight: 1.6, border: "1px solid #ffffff08" }}>
        Les participants scannent le QR code ou suivent le lien pour soumettre des contributions. Elles n'apparaissent dans la matrice qu'après validation dans l'onglet "Contributions".
      </div>
    </div>
  );
}

// ─── SETUP PAGE ────────────────────────────────────────────────
function SetupPage({ meta, onMetaChange, aiConfig, onAIChange, onStart }) {
  const fileRef = useRef(null);

  const handleFiles = async (files) => {
    const parsed = await Promise.all([...files].map(f => parseUploadedFile(f)));
    onMetaChange({ ...meta, documents: [...meta.documents, ...parsed] });
  };

  const statusColor = { extracted: C.ok, partial: C.warn, error: C.err, loading: "#93c5fd", unsupported: C.muted };
  const statusLabel = { extracted: "Extrait ✓", partial: "Partiel", error: "Erreur", loading: "Chargement…", unsupported: "Non supporté" };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h2 style={{ color: C.global, margin: "0 0 8px", fontSize: 22 }}>Nouveau cadre logique</h2>
        <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>Renseignez le contexte. Si l'IA est configurée, elle proposera un cadre complet.</p>
      </div>

      <div style={S.card}>
        <div style={{ color: C.global, fontWeight: 700, fontSize: 13, marginBottom: 16 }}>Contexte du projet</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={S.label}>Nom du projet *</label>
            <input value={meta.name} onChange={e => onMetaChange({ ...meta, name: e.target.value })}
              placeholder="Ex: Projet d'accès à l'eau potable dans la région X" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Contexte / Description</label>
            <textarea value={meta.context} onChange={e => onMetaChange({ ...meta, context: e.target.value })}
              placeholder="Situation, problème central, bénéficiaires, zone géographique…"
              rows={4} style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }} />
          </div>
          <div>
            <label style={S.label}>Objectif de l'atelier</label>
            <input value={meta.workshopObjective} onChange={e => onMetaChange({ ...meta, workshopObjective: e.target.value })}
              placeholder="Ex: Valider la logique d'intervention avec les parties prenantes" style={S.input} />
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ color: C.source, fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
          Documents de référence <span style={{ color: C.muted, fontWeight: 400 }}>(optionnel)</span>
        </div>
        <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          style={{ border: `2px dashed ${C.source}44`, borderRadius: 10, padding: "24px 16px", textAlign: "center", cursor: "pointer", color: C.muted, fontSize: 12 }}>
          Cliquez ou déposez vos fichiers ici<br />
          <span style={{ fontSize: 10, color: "#444" }}>PDF · DOCX · XLSX · CSV · TXT</span>
          <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt"
            style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
        </div>
        {meta.documents.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {meta.documents.map((doc, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#ffffff06", borderRadius: 6, padding: "6px 10px" }}>
                <span style={{ flex: 1, color: "#e2e8f0", fontSize: 11 }}>{doc.name}</span>
                <span style={{ color: statusColor[doc.status] || C.muted, fontSize: 10 }}>{statusLabel[doc.status] || doc.status}</span>
                {doc.note && <span style={{ color: "#555", fontSize: 9 }}>{doc.note}</span>}
                <button onClick={() => onMetaChange({ ...meta, documents: meta.documents.filter((_, j) => j !== i) })}
                  style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 13 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AiConfigPanel config={aiConfig} onChange={onAIChange} />

      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        <button onClick={onStart} disabled={!meta.name.trim()}
          style={{ ...S.btn(meta.name.trim() ? C.global : "#333", meta.name.trim() ? C.global + "88" : "#444", meta.name.trim() ? "#0d1117" : "#555"), padding: "10px 40px", fontSize: 13, opacity: meta.name.trim() ? 1 : 0.5 }}>
          Démarrer →
        </button>
      </div>
    </div>
  );
}

// ─── AI SUGGEST BANNER (cadre complet) ────────────────────────
function AISuggestBanner({ aiConfig, meta, onSuggestion }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (aiConfig.provider === "none") return null;

  const suggest = async () => {
    setError(""); setLoading(true);
    try {
      const result = await generateLogicalFrameworkSuggestions(aiConfig, meta, meta.documents);
      onSuggestion(result);
    } catch (e) { setError(e.message?.slice(0, 80) || "Erreur"); }
    setLoading(false);
  };

  const providerLabel = AI_PROVIDERS.find(p => p.id === aiConfig.provider)?.label;
  return (
    <div style={{ background: C.specific + "11", border: `1px solid ${C.specific}33`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ color: C.specific, fontSize: 11, flex: 1 }}>IA ({providerLabel}) — Générer un cadre logique complet depuis le contexte du projet.</span>
      {error && <span style={{ color: C.err, fontSize: 11 }}>{error}</span>}
      <button onClick={suggest} disabled={loading} style={S.btn(C.specific + "22", C.specific + "66", C.specific)}>
        {loading ? "Génération…" : "✨ Proposer un cadre complet"}
      </button>
    </div>
  );
}

// ─── LEVEL ROW (matrix) ────────────────────────────────────────
function LevelRow({ level, color, setFn, label, aiSuggestFn, aiDisabled }) {
  return (
    <tr>
      <td style={{ ...S.cell(color + "18", color + "44"), fontWeight: 700, color, fontSize: 11, whiteSpace: "nowrap", minWidth: 130 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
          <span>{label}</span>
          {aiSuggestFn && <AiBtn fn={aiSuggestFn} disabled={aiDisabled} small title="Suggérer via IA" />}
        </div>
      </td>
      <td style={S.cell(C.surface, C.border)}><LabelEditor value={level.label} onChange={v => setFn({ label: v })} placeholder="Énoncé…" /></td>
      <td style={S.cell(C.surface, C.border)}><TagList items={level.indicators} onChange={v => setFn({ indicators: v })} placeholder="+ Indicateur" color={C.iov} /></td>
      <td style={S.cell(C.surface, C.border)}><TagList items={level.sources} onChange={v => setFn({ sources: v })} placeholder="+ Source" color={C.source} /></td>
      <td style={S.cell(C.surface, C.border)}><TagList items={level.assumptions} onChange={v => setFn({ assumptions: v })} placeholder="+ Hypothèse" color={C.hyp} /></td>
    </tr>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────
export default function CadreLogique() {
  const [phase,          setPhase]          = useState("setup");
  const [meta,           setMeta]           = useState(EMPTY_META);
  const [aiConfig,       setAIConfig]       = useState(() => loadAIConfig());
  const [data,           setData]           = useState(EMPTY_DATA);
  const [mode,           setMode]           = useState("matrix");
  const [assistStep,     setAssistStep]     = useState(0);
  const [exportMsg,      setExportMsg]      = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [sessionId,      setSessionId]      = useState(() => getSessionId());
  const [showSession,    setShowSession]    = useState(false);
  const [pendingCount,   setPendingCount]   = useState(0);

  // Polling contributions
  useEffect(() => {
    const update = () => setPendingCount(getContributions(sessionId).filter(c => c.status === "pending").length);
    update();
    const iv = setInterval(update, 3000);
    return () => clearInterval(iv);
  }, [sessionId]);

  // ── data updaters
  const setGlobal   = useCallback(p => setData(d => ({ ...d, globalObjective:   { ...d.globalObjective,   ...p } })), []);
  const setSpecific = useCallback(p => setData(d => ({ ...d, specificObjective: { ...d.specificObjective, ...p } })), []);
  const setResult   = useCallback((rid, p) => setData(d => ({ ...d, results: d.results.map(r => r.id === rid ? { ...r, ...p } : r) })), []);
  const setActivity = useCallback((rid, aid, p) =>
    setData(d => ({ ...d, results: d.results.map(r => r.id !== rid ? r : { ...r, activities: r.activities.map(a => a.id === aid ? { ...a, ...p } : a) }) })), []);

  const addResult      = () => setData(d => ({ ...d, results: [...d.results, emptyResult()] }));
  const removeResult   = rid => setData(d => ({ ...d, results: d.results.filter(r => r.id !== rid) }));
  const addActivity    = rid => setData(d => ({ ...d, results: d.results.map(r => r.id === rid ? { ...r, activities: [...r.activities, emptyActivity()] } : r) }));
  const removeActivity = (rid, aid) => setData(d => ({ ...d, results: d.results.map(r => r.id !== rid ? r : { ...r, activities: r.activities.filter(a => a.id !== aid) }) }));

  // ── AI suggestion handlers
  const aiActive = aiConfig.provider !== "none";

  const aiSuggestGlobal   = () => suggestGlobalObjective(aiConfig, meta, meta.documents).then(r => setGlobal(r));
  const aiSuggestSpecific = () => suggestSpecificObjective(aiConfig, meta, meta.documents).then(r => setSpecific(r));
  const aiSuggestResults  = () => suggestResults(aiConfig, meta, meta.documents).then(rs => setData(d => ({ ...d, results: [...d.results, ...rs] })));
  const aiSuggestActivitiesFor = (result) => () =>
    suggestActivities(aiConfig, meta, meta.documents, result.label).then(acts =>
      setResult(result.id, { activities: [...result.activities, ...acts] }));
  const aiSuggestIndicatorsFor = (level, setFn) => () =>
    suggestIndicators(aiConfig, meta, level.label, "").then(inds => setFn({ indicators: [...level.indicators, ...inds] }));
  const aiSuggestAssumptionsFor = (level, setFn) => () =>
    suggestAssumptions(aiConfig, meta, level.label).then(hyps => setFn({ assumptions: [...level.assumptions, ...hyps] }));

  // ── accept contribution
  const handleAcceptContribution = useCallback((type, target, text) => {
    setData(d => {
      switch (type) {
        case "globalObjective":   return { ...d, globalObjective:   { ...d.globalObjective,   label: text } };
        case "specificObjective": return { ...d, specificObjective: { ...d.specificObjective, label: text } };
        case "result":    return { ...d, results: [...d.results, { ...emptyResult(), label: text }] };
        case "activity":  return d.results.length === 0 ? d : (() => {
          const last = d.results[d.results.length - 1];
          return { ...d, results: d.results.map(r => r.id === last.id ? { ...r, activities: [...r.activities, { ...emptyActivity(), label: text }] } : r) };
        })();
        case "indicator":  return { ...d, globalObjective: { ...d.globalObjective, indicators: [...d.globalObjective.indicators, text] } };
        case "source":     return { ...d, globalObjective: { ...d.globalObjective, sources:    [...d.globalObjective.sources,    text] } };
        case "assumption": return { ...d, globalObjective: { ...d.globalObjective, assumptions:[...d.globalObjective.assumptions,text] } };
        default: return d;
      }
    });
  }, []);

  // ── validation
  const issues = [];
  if (!data.globalObjective.label)   issues.push("Objectif global manquant");
  if (!data.specificObjective.label) issues.push("Objectif spécifique manquant");
  if (data.results.length === 0)     issues.push("Aucun résultat défini");
  data.results.forEach((r, i) => {
    if (!r.label)                          issues.push(`Résultat ${i + 1} : libellé manquant`);
    if (r.activities.length === 0)         issues.push(`Résultat ${i + 1} : aucune activité`);
    if (!validateLabel(r.label).ok && r.label) issues.push(`Résultat ${i + 1} : formulation vague`);
  });

  // ── export JSON
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ meta, aiProvider: aiConfig.provider, sessionId, data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `cadre_logique_${meta.name || "export"}.json`; a.click();
    setExportMsg("Exporté ✓"); setTimeout(() => setExportMsg(""), 2000);
  };

  // ── AI full suggestion
  const handleAISuggestion = (suggested) => setData(d => ({
    ...d,
    globalObjective:   suggested.globalObjective   || d.globalObjective,
    specificObjective: suggested.specificObjective || d.specificObjective,
    results:           suggested.results?.length   ? suggested.results : d.results,
  }));

  // ── session reset
  const handleResetSession = () => { const id = resetSession(); setSessionId(id); };

  // ─── MATRIX VIEW ──────────────────────────────────────────────
  const MatrixView = () => (
    <div style={{ overflowX: "auto" }}>
      {!aiActive && (
        <div style={{ background: "#ffffff06", border: "1px solid #ffffff0a", borderRadius: 8, padding: "8px 14px", marginBottom: 12, color: "#555", fontSize: 11 }}>
          Configurez l'IA dans "⚙ Config" pour activer les suggestions automatiques (✨).
        </div>
      )}
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
        <thead>
          <tr>
            <th style={S.th("#a0aec0")}>Niveau</th>
            <th style={S.th("#e2e8f0")}>Description / Logique d'intervention</th>
            <th style={S.th(C.iov)}>Indicateurs (IOV)</th>
            <th style={S.th(C.source)}>Sources de vérification</th>
            <th style={S.th(C.hyp)}>Hypothèses / Risques</th>
          </tr>
        </thead>
        <tbody>
          <LevelRow level={data.globalObjective}   color={C.global}   setFn={setGlobal}   label="🌍 Objectif Global"
            aiSuggestFn={aiActive ? aiSuggestGlobal : null} aiDisabled={!aiActive} />
          <LevelRow level={data.specificObjective} color={C.specific} setFn={setSpecific} label="🎯 Objectif Spécifique"
            aiSuggestFn={aiActive ? aiSuggestSpecific : null} aiDisabled={!aiActive} />

          {data.results.map((result, ri) => (
            <Fragment key={result.id}>
              <tr>
                <td style={{ ...S.cell(C.result + "18", C.result + "44"), fontWeight: 700, color: C.result, fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                    <span>📦 Résultat {ri + 1}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {aiActive && <AiBtn fn={aiSuggestActivitiesFor(result)} small title="Proposer des activités" />}
                      <button onClick={() => removeResult(result.id)} style={{ background: "none", border: "none", color: C.err, cursor: "pointer", fontSize: 13, padding: 0 }}>🗑</button>
                    </div>
                  </div>
                </td>
                <td style={S.cell(C.surface, C.result + "22")}><LabelEditor value={result.label} onChange={v => setResult(result.id, { label: v })} placeholder="Énoncé du résultat…" /></td>
                <td style={S.cell(C.surface, C.result + "22")}><TagList items={result.indicators} onChange={v => setResult(result.id, { indicators: v })} placeholder="+ Indicateur" color={C.iov} /></td>
                <td style={S.cell(C.surface, C.result + "22")}><TagList items={result.sources}    onChange={v => setResult(result.id, { sources: v })}    placeholder="+ Source"     color={C.source} /></td>
                <td style={S.cell(C.surface, C.result + "22")}><TagList items={result.assumptions} onChange={v => setResult(result.id, { assumptions: v })} placeholder="+ Hypothèse"  color={C.hyp} /></td>
              </tr>

              {result.activities.map((act, ai) => (
                <tr key={act.id}>
                  <td style={{ ...S.cell(C.activity + "12", C.activity + "33"), color: C.activity, fontSize: 10, paddingLeft: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                      <span>⚡ {ri + 1}.{ai + 1}</span>
                      <button onClick={() => removeActivity(result.id, act.id)} style={{ background: "none", border: "none", color: C.err, cursor: "pointer", fontSize: 12, padding: 0 }}>×</button>
                    </div>
                  </td>
                  <td style={S.cell("#161b28", C.activity + "1a")}><LabelEditor value={act.label} onChange={v => setActivity(result.id, act.id, { label: v })} placeholder="Description de l'activité…" /></td>
                  <td style={S.cell("#161b28", C.activity + "1a")}><TagList items={act.indicators} onChange={v => setActivity(result.id, act.id, { indicators: v })} placeholder="+ Indicateur" color={C.iov} /></td>
                  <td style={S.cell("#161b28", C.activity + "1a")}><TagList items={act.sources}    onChange={v => setActivity(result.id, act.id, { sources: v })}    placeholder="+ Source"     color={C.source} /></td>
                  <td style={S.cell("#161b28", C.activity + "1a")}><TagList items={act.assumptions} onChange={v => setActivity(result.id, act.id, { assumptions: v })} placeholder="+ Hypothèse"  color={C.hyp} /></td>
                </tr>
              ))}

              <tr>
                <td colSpan={5} style={{ padding: "6px 12px", background: C.activity + "08", border: `1px dashed ${C.activity}33` }}>
                  <button onClick={() => addActivity(result.id)} style={{ ...S.btn(C.activity + "22", C.activity + "88", C.activity), padding: "5px 16px", fontSize: 11 }}>
                    + Activité au Résultat {ri + 1}
                  </button>
                </td>
              </tr>
            </Fragment>
          ))}

          <tr>
            <td colSpan={5} style={{ padding: "10px 12px", background: C.result + "08", border: `1px dashed ${C.result}33` }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={addResult} style={{ ...S.btn(C.result + "22", C.result + "88", C.result), padding: "7px 20px", fontSize: 12 }}>+ Résultat</button>
                {aiActive && <AiBtn fn={aiSuggestResults} title="Proposer des résultats via IA" />}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // ─── ASSISTANT VIEW ────────────────────────────────────────────
  const STEPS = [
    { title: "Objectif Global",       desc: "La finalité à long terme à laquelle contribue le projet." },
    { title: "Objectif Spécifique",   desc: "Le but direct du projet, à atteindre en fin d'intervention." },
    { title: "Résultats & Activités", desc: "Les extrants produits et les actions à mener." },
    { title: "Indicateurs & Sources", desc: "Comment mesurer et vérifier les résultats." },
    { title: "Hypothèses",            desc: "Facteurs externes nécessaires mais hors contrôle." },
  ];

  const AssistantView = () => (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => setAssistStep(i)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: i === assistStep ? 800 : 500, background: i === assistStep ? C.global + "22" : "#ffffff09", border: `1.5px solid ${i === assistStep ? C.global : "#ffffff22"}`, color: i === assistStep ? C.global : C.muted }}>
            {i + 1}. {s.title}
          </button>
        ))}
      </div>

      <div style={{ background: C.surface, borderRadius: 12, padding: 28, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ color: C.global, margin: "0 0 4px", fontSize: 16 }}>{STEPS[assistStep].title}</h3>
            <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>{STEPS[assistStep].desc}</p>
          </div>
          {/* IA per-step buttons */}
          {aiActive && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
              {assistStep === 0 && <AiBtn fn={aiSuggestGlobal}   title="Proposer objectif global" />}
              {assistStep === 1 && <AiBtn fn={aiSuggestSpecific} title="Proposer objectif spécifique" />}
              {assistStep === 2 && <AiBtn fn={aiSuggestResults}  title="Proposer des résultats" />}
              {assistStep === 3 && (
                <AiBtn title="Proposer des indicateurs"
                  fn={() => suggestIndicators(aiConfig, meta, data.globalObjective.label, "Objectif global").then(inds => setGlobal({ indicators: [...data.globalObjective.indicators, ...inds] }))} />
              )}
              {assistStep === 4 && (
                <AiBtn title="Proposer des hypothèses"
                  fn={() => suggestAssumptions(aiConfig, meta, data.globalObjective.label).then(hyps => setGlobal({ assumptions: [...data.globalObjective.assumptions, ...hyps] }))} />
              )}
            </div>
          )}
          {!aiActive && <span style={{ fontSize: 10, color: "#444" }}>Configurez l'IA pour les suggestions</span>}
        </div>

        {assistStep === 0 && (
          <>
            <LabelEditor value={data.globalObjective.label} onChange={v => setGlobal({ label: v })} placeholder="Ex: Contribuer à la réduction de la pauvreté dans la région X" />
            <div style={{ marginTop: 16 }}>
              <div style={S.label}>Indicateurs (IOV)</div>
              <TagList items={data.globalObjective.indicators} onChange={v => setGlobal({ indicators: v })} placeholder="+ Indicateur" color={C.iov} />
            </div>
          </>
        )}
        {assistStep === 1 && (
          <>
            <LabelEditor value={data.specificObjective.label} onChange={v => setSpecific({ label: v })} placeholder="Ex: 5 000 ménages accèdent aux services de santé d'ici 2026" />
            <div style={{ marginTop: 16 }}>
              <div style={S.label}>Indicateurs (IOV)</div>
              <TagList items={data.specificObjective.indicators} onChange={v => setSpecific({ indicators: v })} placeholder="+ Indicateur" color={C.iov} />
            </div>
          </>
        )}
        {assistStep === 2 && (
          <div>
            {data.results.map((r, ri) => (
              <div key={r.id} style={{ background: "#ffffff08", borderRadius: 8, padding: 16, marginBottom: 12, border: `1px solid ${C.result}33` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: C.result, fontWeight: 700, fontSize: 12 }}>Résultat {ri + 1}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {aiActive && <AiBtn fn={aiSuggestActivitiesFor(r)} small title="Proposer des activités" />}
                    <button onClick={() => removeResult(r.id)} style={{ background: "none", border: "none", color: C.err, cursor: "pointer" }}>🗑</button>
                  </div>
                </div>
                <LabelEditor value={r.label} onChange={v => setResult(r.id, { label: v })} placeholder="Énoncé du résultat…" />
                <div style={{ marginTop: 12, paddingLeft: 12, borderLeft: `2px solid ${C.activity}44` }}>
                  <div style={{ color: C.activity, fontSize: 11, marginBottom: 6, fontWeight: 600 }}>Activités</div>
                  {r.activities.map((a, ai) => (
                    <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ color: "#666", fontSize: 11, paddingTop: 8 }}>{ri + 1}.{ai + 1}</span>
                      <div style={{ flex: 1 }}><LabelEditor value={a.label} onChange={v => setActivity(r.id, a.id, { label: v })} placeholder="Description de l'activité…" /></div>
                      <button onClick={() => removeActivity(r.id, a.id)} style={{ background: "none", border: "none", color: C.err, cursor: "pointer", paddingTop: 8 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => addActivity(r.id)} style={{ background: "none", border: `1px dashed ${C.activity}66`, borderRadius: 4, padding: "4px 12px", color: C.activity, cursor: "pointer", fontSize: 11 }}>+ Activité</button>
                </div>
              </div>
            ))}
            <button onClick={addResult} style={{ ...S.btn(C.result + "22", C.result + "88", C.result), padding: "8px 20px" }}>+ Résultat</button>
          </div>
        )}
        {assistStep === 3 && (
          <div>
            {[
              { title: "Objectif Global",     items: data.globalObjective.indicators,   setFn: v => setGlobal({ indicators: v }),   src: data.globalObjective.sources,   setSrc: v => setGlobal({ sources: v }) },
              { title: "Objectif Spécifique", items: data.specificObjective.indicators, setFn: v => setSpecific({ indicators: v }), src: data.specificObjective.sources, setSrc: v => setSpecific({ sources: v }) },
              ...data.results.map((r, i) => ({ title: `Résultat ${i + 1}`, items: r.indicators, setFn: v => setResult(r.id, { indicators: v }), src: r.sources, setSrc: v => setResult(r.id, { sources: v }) })),
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ color: "#a0aec0", fontSize: 11, marginBottom: 8, fontWeight: 600 }}>{item.title}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ color: C.iov, fontSize: 10, marginBottom: 4 }}>IOV</div>
                    <TagList items={item.items} onChange={item.setFn} placeholder="+ Indicateur" color={C.iov} />
                  </div>
                  <div>
                    <div style={{ color: C.source, fontSize: 10, marginBottom: 4 }}>Sources</div>
                    <TagList items={item.src} onChange={item.setSrc} placeholder="+ Source" color={C.source} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {assistStep === 4 && (
          <div>
            {[
              { title: "Objectif Global",     items: data.globalObjective.assumptions,   setFn: v => setGlobal({ assumptions: v }) },
              { title: "Objectif Spécifique", items: data.specificObjective.assumptions, setFn: v => setSpecific({ assumptions: v }) },
              ...data.results.map((r, i) => ({ title: `Résultat ${i + 1}`, items: r.assumptions, setFn: v => setResult(r.id, { assumptions: v }) })),
            ].map((item, idx) => (
              <div key={idx} style={{ marginBottom: 16 }}>
                <div style={{ color: "#a0aec0", fontSize: 11, marginBottom: 6, fontWeight: 600 }}>{item.title}</div>
                <TagList items={item.items} onChange={item.setFn} placeholder="+ Hypothèse (formulation positive)" color={C.hyp} />
              </div>
            ))}
            <div style={{ background: C.warn + "11", border: `1px solid ${C.warn}44`, borderRadius: 8, padding: 12, marginTop: 16 }}>
              <div style={{ color: C.warn, fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Rappel</div>
              <div style={{ color: "#d97706", fontSize: 11 }}>Les hypothèses doivent être formulées positivement et couvrir les facteurs hors contrôle du projet.</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button onClick={() => setAssistStep(s => Math.max(0, s - 1))} disabled={assistStep === 0}
            style={{ background: "#ffffff11", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 20px", color: assistStep === 0 ? "#444" : "#ccc", cursor: assistStep === 0 ? "not-allowed" : "pointer", fontSize: 12 }}>← Précédent</button>
          {assistStep < STEPS.length - 1
            ? <button onClick={() => setAssistStep(s => s + 1)} style={{ ...S.btn(C.global + "22", C.global + "66", C.global), padding: "8px 20px" }}>Suivant →</button>
            : <button onClick={() => setMode("matrix")} style={{ ...S.btn(C.global, C.global, "#0d1117"), padding: "8px 20px" }}>Voir la matrice ✓</button>
          }
        </div>
      </div>
    </div>
  );

  // ─── SETUP PHASE ──────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'IBM Plex Mono','Courier New',monospace", color: C.text, padding: "32px 16px" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 6, height: 24, background: C.global, borderRadius: 2 }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: "#f0fdf4" }}>Cadre Logique</span>
            <span style={{ background: C.global + "22", color: C.global, border: `1px solid ${C.global}44`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>GAR</span>
          </div>
        </div>
        <SetupPage meta={meta} onMetaChange={setMeta} aiConfig={aiConfig} onAIChange={setAIConfig} onStart={() => setPhase("work")} />
      </div>
    );
  }

  // ─── WORK PHASE ───────────────────────────────────────────────
  const MODES = [
    { id: "matrix",        label: "📊 Matrice" },
    { id: "assistant",     label: "🧭 Assistant" },
    { id: "contributions", label: `👥 Contributions${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'IBM Plex Mono','Courier New',monospace", color: C.text, padding: "20px 16px" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{ marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 28, background: C.global, borderRadius: 2 }} />
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#f0fdf4", letterSpacing: "-0.02em" }}>Cadre Logique</h1>
              <span style={{ background: C.global + "22", color: C.global, border: `1px solid ${C.global}44`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>GAR</span>
            </div>
            {meta.name && <div style={{ color: C.muted, fontSize: 11, marginTop: 4, paddingLeft: 18 }}>{meta.name}</div>}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setPhase("setup")} style={{ ...S.btn("#ffffff09", C.border, C.muted), padding: "7px 12px", fontSize: 10 }}>⚙ Config</button>
            <button onClick={() => setShowSession(s => !s)} style={S.btn(C.source + "22", C.source + "44", C.source)}>
              🔗 Session
            </button>
            <div style={{ display: "flex", background: "#ffffff09", borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {MODES.map((m, i) => (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                  background: mode === m.id ? C.global + "22" : "transparent",
                  color: mode === m.id ? C.global : C.muted,
                  borderRight: i < MODES.length - 1 ? `1px solid ${C.border}` : "none",
                }}>{m.label}</button>
              ))}
            </div>
            <button onClick={() => setShowValidation(!showValidation)} style={S.btn(
              issues.length ? C.warn + "22" : C.ok + "22",
              issues.length ? C.warn + "66" : C.ok + "66",
              issues.length ? C.warn : C.ok,
            )}>
              {issues.length ? `⚠ ${issues.length} alerte${issues.length > 1 ? "s" : ""}` : "✓ Valide"}
            </button>
            <button onClick={exportJSON} style={S.btn(C.specific + "22", C.specific + "66", C.specific)}>
              {exportMsg || "⬇ Export JSON"}
            </button>
          </div>
        </div>

        {showValidation && (
          <div style={{ marginTop: 12, background: issues.length ? C.warn + "0d" : C.ok + "0d", border: `1px solid ${issues.length ? C.warn : C.ok}33`, borderRadius: 8, padding: "12px 16px" }}>
            {issues.length > 0
              ? <><div style={{ color: C.warn, fontWeight: 700, fontSize: 11, marginBottom: 8 }}>Points à corriger :</div>{issues.map((iss, i) => <div key={i} style={{ color: "#d97706", fontSize: 11, marginBottom: 3 }}>• {iss}</div>)}</>
              : <div style={{ color: C.ok, fontSize: 11 }}>✓ Cadre logique cohérent — aucun problème détecté.</div>}
          </div>
        )}
      </div>

      {/* Session panel */}
      {showSession && (
        <div style={{ marginBottom: 16 }}>
          <SessionPanel sessionId={sessionId} onReset={handleResetSession} pendingCount={pendingCount} />
        </div>
      )}

      {/* Legend (matrix/assistant only) */}
      {mode !== "contributions" && (
        <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
          {[["global","Objectif global"],["specific","Objectif spécifique"],["result","Résultats"],["activity","Activités"],["iov","IOV"],["source","Sources"],["hyp","Hypothèses"]].map(([k, label]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, background: C[k], borderRadius: 2 }} />
              <span style={{ color: C.muted, fontSize: 10 }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI banner (matrix/assistant) */}
      {mode !== "contributions" && (
        <AISuggestBanner aiConfig={aiConfig} meta={meta} onSuggestion={handleAISuggestion} />
      )}

      {/* Content */}
      {mode === "matrix"        && <MatrixView />}
      {mode === "assistant"     && <AssistantView />}
      {mode === "contributions" && (
        <ModeratorContributionsPanel
          sessionId={sessionId}
          data={data}
          onAccept={handleAcceptContribution}
        />
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid #ffffff0a", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ color: "#333", fontSize: 10 }}>
          {data.results.length} résultat{data.results.length > 1 ? "s" : ""} · {data.results.reduce((s, r) => s + r.activities.length, 0)} activités
          {pendingCount > 0 && <span style={{ color: C.warn, marginLeft: 8 }}> · {pendingCount} contribution{pendingCount > 1 ? "s" : ""} en attente</span>}
        </div>
        <div style={{ color: "#333", fontSize: 10 }}>Cadre logique — Méthode GAR · Standards USAID/CE</div>
      </div>
    </div>
  );
}
