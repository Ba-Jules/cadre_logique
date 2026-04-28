import { useState } from "react";
import { saveContribution } from "./collaborationStore.js";

const TYPES = [
  { id: "globalObjective",   label: "Objectif global" },
  { id: "specificObjective", label: "Objectif spécifique" },
  { id: "result",            label: "Résultat attendu" },
  { id: "activity",          label: "Activité" },
  { id: "indicator",         label: "Indicateur (IOV)" },
  { id: "source",            label: "Source de vérification" },
  { id: "assumption",        label: "Hypothèse / Risque" },
];

const S = {
  input: {
    width: "100%", background: "#ffffff0a", border: "1px solid #ffffff22",
    borderRadius: 6, padding: "8px 12px", color: "#e2e8f0",
    fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  },
  label: { color: "#a0aec0", fontSize: 11, marginBottom: 6, display: "block" },
};

export default function ParticipantView({ sessionId }) {
  const [type,   setType]   = useState("specificObjective");
  const [target, setTarget] = useState("");
  const [text,   setText]   = useState("");
  const [sent,   setSent]   = useState(false);
  const [count,  setCount]  = useState(0);

  const submit = () => {
    if (!text.trim()) return;
    saveContribution({ sessionId, type, target: target || TYPES.find(t => t.id === type)?.label, text });
    setText("");
    setTarget("");
    setSent(true);
    setCount(c => c + 1);
    setTimeout(() => setSent(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`* { box-sizing:border-box; } textarea::placeholder,input::placeholder{color:#555;} select,textarea,input{outline:none;} button:hover{opacity:0.85;}`}</style>
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 6, height: 20, background: "#6ee7b7", borderRadius: 2 }} />
            <span style={{ fontSize: 18, fontWeight: 800, color: "#f0fdf4" }}>Cadre Logique</span>
            <span style={{ background: "#6ee7b722", color: "#6ee7b7", border: "1px solid #6ee7b744", borderRadius: 4, padding: "2px 6px", fontSize: 9, fontWeight: 700 }}>PARTICIPANT</span>
          </div>
          <div style={{ color: "#666", fontSize: 11 }}>Session : <strong style={{ color: "#93c5fd" }}>{sessionId}</strong></div>
          {count > 0 && <div style={{ color: "#22c55e", fontSize: 10, marginTop: 4 }}>{count} contribution{count > 1 ? "s" : ""} envoyée{count > 1 ? "s" : ""} cette session</div>}
        </div>

        <div style={{ background: "#1a1f2e", borderRadius: 12, padding: 28, border: "1px solid #ffffff14" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Type de contribution</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...S.input, cursor: "pointer" }}>
              {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Précision / Cible <span style={{ color: "#444" }}>(optionnel)</span></label>
            <input value={target} onChange={e => setTarget(e.target.value)}
              placeholder="Ex: Résultat 2, Activité 1.3…"
              style={S.input} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Votre proposition *</label>
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="Saisissez votre contribution ici…"
              rows={4}
              style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }} />
          </div>

          <button onClick={submit} disabled={!text.trim()} style={{
            width: "100%", background: text.trim() ? "#6ee7b7" : "#333",
            border: "none", borderRadius: 8, padding: "10px 0",
            color: text.trim() ? "#0d1117" : "#555", cursor: text.trim() ? "pointer" : "not-allowed",
            fontSize: 13, fontWeight: 800, transition: "all 0.2s",
          }}>
            {sent ? "Envoyée ✓" : "Envoyer la contribution"}
          </button>

          <div style={{ marginTop: 16, background: "#ffffff06", borderRadius: 8, padding: 12, border: "1px solid #ffffff0a", fontSize: 10, color: "#555", lineHeight: 1.6 }}>
            Votre contribution sera soumise au modérateur avant d'être intégrée au cadre logique.
          </div>
        </div>
      </div>
    </div>
  );
}
