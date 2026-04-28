// documentParser.js
// Extraction texte pour les fichiers uploadés.
//
// TXT / CSV / MD  → extraction complète (natif)
// PDF             → stub (installer pdfjs-dist pour activer)
// DOCX            → stub (installer mammoth pour activer)
// XLSX / XLS      → stub (installer xlsx pour activer)

export async function parseUploadedFile(file) {
  const entry = {
    name: file.name,
    type: file.type,
    size: file.size,
    status: "loading",
    extractedText: null,
    note: null,
  };

  try {
    if (file.name.match(/\.(txt|csv|md)$/i)) {
      entry.extractedText = await file.text();
      entry.status = "extracted";
      return entry;
    }

    if (file.name.match(/\.pdf$/i)) {
      // Pour activer : npm install pdfjs-dist
      // puis remplacer ce bloc par l'import dynamique
      entry.status = "partial";
      entry.note = "PDF chargé — installer pdfjs-dist pour extraire le texte";
      return entry;
    }

    if (file.name.match(/\.docx$/i)) {
      // Pour activer : npm install mammoth
      entry.status = "partial";
      entry.note = "DOCX chargé — installer mammoth pour extraire le texte";
      return entry;
    }

    if (file.name.match(/\.xlsx?$/i)) {
      // Pour activer : npm install xlsx
      entry.status = "partial";
      entry.note = "Excel chargé — installer xlsx pour extraire le texte";
      return entry;
    }

    entry.status = "unsupported";
    entry.note = "Format non supporté (TXT, CSV, PDF, DOCX, XLSX uniquement)";
  } catch (e) {
    entry.status = "error";
    entry.note = e.message || "Erreur de lecture";
  }

  return entry;
}
