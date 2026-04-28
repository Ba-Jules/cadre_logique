import { useState, useEffect } from "react";
import { askAi } from "./aiAssistant.js";

const LS_KEY = "cadre_logique_ai_config";

export const AI_PROVIDERS = [
  { id: "none",       label: "Aucun (manuel)" },
  { id: "claude",     label: "Claude (Anthropic)" },
  { id: "openai",     label: "OpenAI (GPT)" },
  { id: "gemini",     label: "Google Gemini" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "mistral",    label: "Mistral AI" },
  { id: "groq",       label: "Groq" },
  { id: "ollama",     label: "Ollama (local)" },
];

export const EMPTY_AI = { provider: "none", apiKey: "", model: "", status: "idle" };

export function loadAIConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...EMPTY_AI, ...JSON.parse(raw) };
  } catch {}
  return EMPTY_AI;
}

function persistAIConfig(config) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(config)); } catch {}
}

// Styles partagés (passés en prop ou définis localement)
const S = {
  input: {
    width: "100%", background: "#ffffff0a", border: "1px solid #ffffff22",
    borderRadius: 6, padding: "8px 12px", color: "#e2e8f0",
    fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  },
  label: { color: "#a0aec0", fontSize: 11, marginBottom: 6, display: "block" },
  card: { background: "#1a1f2e", borderRadius: 12, padding: 24, border: "1px solid #ffffff14", marginBottom: 16 },
};

const STATUS_COLOR = { idle: "#666", connected: "#22c55e", error: "#f87171" };
const STATUS_LABEL = { idle: "Non testé", connected: "Connecté ✓", error: "Erreur de connexion ✗" };

export default function AiConfigPanel({ config, onChange }) {
  const [testing, setTesting] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);

  // Persiste à chaque changement
  useEffect(() => { persistAIConfig(config); }, [config]);

  const update = (patch) => onChange({ ...config, ...patch, status: "idle" });

  const testConnection = async () => {
    setTesting(true);
    try {
      await askAi(config, "Test.", "Réponds uniquement OK.");
      onChange({ ...config, status: "connected" });
      persistAIConfig({ ...config, status: "connected" });
    } catch {
      onChange({ ...config, status: "error" });
      persistAIConfig({ ...config, status: "error" });
    } finally {
      setTesting(false);
    }
  };

  const needsKey = config.provider !== "none" && config.provider !== "ollama";

  return (
    <div style={S.card}>
      <div style={{ color: "#93c5fd", fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
        IA — Configuration
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={S.label}>Fournisseur</label>
          <select value={config.provider} onChange={e => update({ provider: e.target.value })}
            style={{ ...S.input, cursor: "pointer" }}>
            {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        {needsKey && (
          <div>
            <label style={S.label}>Clé API</label>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                type={keyVisible ? "text" : "password"}
                value={config.apiKey}
                onChange={e => update({ apiKey: e.target.value })}
                placeholder="sk-…"
                autoComplete="off"
                style={{ ...S.input, flex: 1 }}
              />
              <button onClick={() => setKeyVisible(v => !v)}
                title={keyVisible ? "Masquer" : "Afficher"}
                style={{ background: "#ffffff11", border: "1px solid #ffffff22", borderRadius: 6, padding: "0 10px", cursor: "pointer", color: "#888", fontSize: 12 }}>
                {keyVisible ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        )}

        {config.provider !== "none" && (
          <div>
            <label style={S.label}>Modèle <span style={{ color: "#444" }}>(optionnel)</span></label>
            <input value={config.model} onChange={e => update({ model: e.target.value })}
              placeholder="Laissez vide pour le défaut" style={S.input} />
          </div>
        )}
      </div>

      {config.provider !== "none" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button onClick={testConnection} disabled={testing || (!config.apiKey && needsKey)}
            style={{ background: "#93c5fd22", border: "1px solid #93c5fd66", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#93c5fd", opacity: testing ? 0.6 : 1 }}>
            {testing ? "Test…" : "Tester la connexion"}
          </button>
          <span style={{ color: STATUS_COLOR[config.status], fontSize: 11 }}>
            {STATUS_LABEL[config.status]}
          </span>
        </div>
      )}
    </div>
  );
}
