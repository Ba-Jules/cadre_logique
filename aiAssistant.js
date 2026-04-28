const uid = () => Math.random().toString(36).slice(2, 8);

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  mistral: "mistral-small-latest",
  groq: "llama3-8b-8192",
};

const ENDPOINTS = {
  openai:     "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  mistral:    "https://api.mistral.ai/v1/chat/completions",
  groq:       "https://api.groq.com/openai/v1/chat/completions",
};

export async function askAi({ provider, apiKey, model }, systemPrompt, userPrompt) {
  if (!provider || provider === "none") throw new Error("Aucun fournisseur IA configuré");

  if (provider === "ollama") {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "mistral", prompt: systemPrompt + "\n\n" + userPrompt, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    return (await res.json()).response;
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-1.5-flash"}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }] }) }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text;
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: model || "claude-haiku-4-5-20251001", max_tokens: 2048,
        system: systemPrompt, messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    return (await res.json()).content?.[0]?.text;
  }

  if (!ENDPOINTS[provider]) throw new Error(`Provider inconnu : ${provider}`);
  const res = await fetch(ENDPOINTS[provider], {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || DEFAULT_MODELS[provider],
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}`);
  return (await res.json()).choices?.[0]?.message?.content;
}

const SYS = "Tu es expert en Gestion Axée sur les Résultats (GAR). Réponds UNIQUEMENT en JSON valide, sans markdown.";

function parseJSON(raw) {
  return JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
}

function buildContext(meta, documents = []) {
  return [
    meta.name            && `Projet : ${meta.name}`,
    meta.context         && `Contexte : ${meta.context}`,
    meta.workshopObjective && `Objectif atelier : ${meta.workshopObjective}`,
    documents.length     && `Documents : ${documents.map(d => d.name + (d.extractedText ? ` — ${d.extractedText.slice(0, 300)}` : "")).join(" | ")}`,
  ].filter(Boolean).join("\n");
}

export async function suggestGlobalObjective(aiConfig, meta, documents) {
  const raw = await askAi(aiConfig, SYS,
    `${buildContext(meta, documents)}\n\nPropose un objectif global SMART.\nJSON: {"label":"","indicators":[],"sources":[],"assumptions":[]}`
  );
  return parseJSON(raw);
}

export async function suggestSpecificObjective(aiConfig, meta, documents) {
  const raw = await askAi(aiConfig, SYS,
    `${buildContext(meta, documents)}\n\nPropose un objectif spécifique SMART.\nJSON: {"label":"","indicators":[],"sources":[],"assumptions":[]}`
  );
  return parseJSON(raw);
}

export async function suggestResults(aiConfig, meta, documents) {
  const raw = await askAi(aiConfig, SYS,
    `${buildContext(meta, documents)}\n\nPropose 2-3 résultats attendus (sans activités).\nJSON: [{"label":"","indicators":[],"sources":[],"assumptions":[]}]`
  );
  return parseJSON(raw).map(r => ({ id: uid(), ...r, activities: [] }));
}

export async function suggestActivities(aiConfig, meta, documents, resultLabel) {
  const raw = await askAi(aiConfig, SYS,
    `${buildContext(meta, documents)}\nRésultat : ${resultLabel}\n\nPropose 2-3 activités pour ce résultat.\nJSON: [{"label":"","indicators":[],"sources":[],"assumptions":[]}]`
  );
  return parseJSON(raw).map(a => ({ id: uid(), ...a }));
}

export async function suggestIndicators(aiConfig, meta, targetLabel, targetType) {
  const raw = await askAi(aiConfig, SYS,
    `Contexte : ${buildContext(meta)}\nNiveau : ${targetType} — ${targetLabel}\n\nPropose 2-3 indicateurs SMART.\nJSON: ["..."]`
  );
  return parseJSON(raw);
}

export async function suggestAssumptions(aiConfig, meta, targetLabel) {
  const raw = await askAi(aiConfig, SYS,
    `Contexte : ${buildContext(meta)}\nNiveau : ${targetLabel}\n\nPropose 2-3 hypothèses externes (formulation positive).\nJSON: ["..."]`
  );
  return parseJSON(raw);
}

export async function generateLogicalFrameworkSuggestions(aiConfig, meta, documents) {
  const raw = await askAi(aiConfig, SYS,
    `${buildContext(meta, documents)}\n\nGénère un cadre logique complet :\n{"globalObjective":{"label":"","indicators":[],"sources":[],"assumptions":[]},"specificObjective":{"label":"","indicators":[],"sources":[],"assumptions":[]},"results":[{"label":"","indicators":[],"sources":[],"assumptions":[],"activities":[{"label":"","indicators":[],"sources":[],"assumptions":[]}]}]}\n2-3 résultats, 2-3 activités. SMART, en français.`
  );
  const parsed = parseJSON(raw);
  parsed.results = (parsed.results || []).map(r => ({
    id: uid(), ...r,
    activities: (r.activities || []).map(a => ({ id: uid(), ...a })),
  }));
  return parsed;
}
