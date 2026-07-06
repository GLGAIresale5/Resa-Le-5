"use client";

import { useState } from "react";

// Montant cliquable = copie directe au presse-papiers (format "227,36", prêt à coller
// dans un tableur / la compta). copyable=false → simple affichage (ex. total HT de vérif).
export default function CopyAmount({
  value,
  display,
  className = "",
  copyable = true,
}: {
  value: number;
  display: string;
  className?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!copyable) {
    return <span className={className}>{display}</span>;
  }

  const copy = () => {
    const text = value.toFixed(2).replace(".", ",");
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      })
      .catch(() => {});
  };

  return (
    <span
      onClick={copy}
      title="Cliquer pour copier"
      style={copied ? { color: "#6ee7b7" } : undefined}
      className={`cursor-pointer ${copied ? "" : "hover:underline"} ${className}`}
    >
      {display}
      {copied && (
        <span className="ml-1 text-[10px]" style={{ color: "#6ee7b7" }}>
          copié
        </span>
      )}
    </span>
  );
}
