"use client";

import { useState } from "react";

// Compte comptable suggéré par l'OCR, éditable. Sauvegarde au blur / Entrée si modifié.
// (Remonté à chaque expand du détail via la clé de ligne → pas besoin de resync la prop.)
export default function CompteComptableField({
  value,
  onSave,
}: {
  value?: string;
  onSave: (v: string) => void;
}) {
  const [val, setVal] = useState(value ?? "");
  const [saved, setSaved] = useState(false);

  const commit = () => {
    const v = val.trim();
    if (v !== (value ?? "")) {
      onSave(v);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="ex. 601"
        className="w-20 rounded border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-xs text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
      />
      {saved && (
        <span className="text-[10px]" style={{ color: "#6ee7b7" }}>
          enregistré
        </span>
      )}
    </span>
  );
}
