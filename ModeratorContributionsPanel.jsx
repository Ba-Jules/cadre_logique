import { useState } from "react";
import { getContributions, updateContribution, removeContribution } from "./collaborationStore.js";

const TYPE_LABELS = {
  globalObjective:   "Objectif global",
  specificObjective: "Objectif spécifique",
  result:            "Résultat",
  activity:          "Activité",
  indicator:         "Indicateur",
  source:            "Source",
  assumption:        "Hypothèse",
};

const TYPE_COLORS = {
  globalObjective:   "#6ee7b7",
  specificObjective: "#93c5fd",
  result:            "#c4b5fd",
  activity:          "#fcd34d",
  indicator:         "#86efac",
  source:            "#7dd3fc",
  assumption:        "#fca5a5",
};

export default function ModeratorContributionsPanel({ sessionId, data, onAccept }) {
  const [editId,   setEditId]   = useState(null);
  const [editText, setEditText]  = useState("");
  const [filter,   setFilter]    = useState("pending");

  const contributions = getContributions(sessionId).filter(c =>
    filter === "all" ? true : c.status === filter
  );

  const accept = (c) => {
    const text = editId === c.id ? editText : c.text;
    onAccept(c.type, c.target, text);
    updateContribution(c.id, { status: "accepted" });
    if (editId === c.id) setEditId(null);
  };

  const reject = (id) => {
    updateContribution(id, { status: "rejected" });
    if (editId === id) setEditId(null);
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setEditText(c.text);
  };

  const pending = getContributions(sessionId).filter(c => c.status === "pending").length;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>
          Contributions des participants
          {pending > 0 && (
            <span style={{ marginLeft: 8, background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44", borderRadius: 10, padding: "2px 8px", fontSize: 10 }}>
              {pending} en attente
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["pending", "accepted", "rejected", "all"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "#ffffff18" : "transparent",
              border: `1px solid ${filter === f ? "#ffffff33" : "#ffffff11"}`,
              borderRadius: 6, padding: "5px 12px", cursor: "pointer",
              color: filter === f ? "#e2e8f0" : "#666", fontSize: 10,
            }}>
              {f === "pending" ? "En attente" : f === "accepted" ? "Acceptées" : f === "rejected" ? "Rejetées" : "Toutes"}
            </button>
          ))}
        </div>
      </div>

      {contributions.length === 0 ? (
        <div style={{ background: "#1a1f2e", borderRadius: 12, padding: 40, textAlign: "center", border: "1px solid #ffffff0a", color: "#444", fontSize: 12 }}>
          {filter === "pending" ? "Aucune contribution en attente." : "Aucune contribution dans cette catégorie."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {contributions.map(c => {
            const color = TYPE_COLORS[c.type] || "#a0aec0";
            const isEditing = editId === c.id;
            return (
              <div key={c.id} style={{ background: "#1a1f2e", borderRadius: 10, padding: 16, border: `1px solid ${color}22`, opacity: c.status !== "pending" ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "2px 8px", fontSize: 10 }}>
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                    {c.target && c.target !== TYPE_LABELS[c.type] && (
                      <span style={{ color: "#666", fontSize: 10, padding: "3px 0" }}>→ {c.target}</span>
                    )}
                  </div>
                  <span style={{ color: "#444", fontSize: 10, flexShrink: 0 }}>
                    {new Date(c.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {isEditing ? (
                  <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                    style={{ width: "100%", background: "#ffffff0a", border: "1px solid #ffffff33", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                ) : (
                  <div style={{ color: "#e2e8f0", fontSize: 12, lineHeight: 1.6, padding: "4px 0" }}>{c.text}</div>
                )}

                {c.status === "pending" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => accept(c)} style={{ background: "#22c55e22", border: "1px solid #22c55e66", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#22c55e", fontSize: 11, fontWeight: 700 }}>Accepter (modifié)</button>
                        <button onClick={() => setEditId(null)} style={{ background: "transparent", border: "1px solid #ffffff22", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#888", fontSize: 11 }}>Annuler</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => accept(c)} style={{ background: "#22c55e22", border: "1px solid #22c55e66", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#22c55e", fontSize: 11, fontWeight: 700 }}>✓ Accepter</button>
                        <button onClick={() => startEdit(c)} style={{ background: "#f59e0b22", border: "1px solid #f59e0b66", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>✎ Modifier</button>
                        <button onClick={() => reject(c.id)} style={{ background: "#f8717122", border: "1px solid #f8717166", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#f87171", fontSize: 11, fontWeight: 700 }}>✕ Rejeter</button>
                      </>
                    )}
                  </div>
                )}

                {c.status !== "pending" && (
                  <div style={{ marginTop: 8, color: c.status === "accepted" ? "#22c55e" : "#f87171", fontSize: 10 }}>
                    {c.status === "accepted" ? "✓ Acceptée et intégrée" : "✕ Rejetée"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
