/**
 * cast-section.tsx
 * Dàn Nhân Vật (Cast) component for Copy Video flow – light theme
 * Renders an array of characters from CopyVideoAnalysisData
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiCheckLine, RiFileCopyLine, RiUser3Fill } from "react-icons/ri";
import { CopyVideoAnalysisData, CopyVideoCharacter } from "../../constants";

/** Color palette for character cards */
const CHARACTER_COLORS = [
  { bg: "bg-yellow-50", border: "border-yellow-200", label: "text-yellow-700" },
  { bg: "bg-blue-50", border: "border-blue-200", label: "text-blue-700" },
  { bg: "bg-pink-50", border: "border-pink-200", label: "text-pink-700" },
  { bg: "bg-green-50", border: "border-green-200", label: "text-green-700" },
  { bg: "bg-purple-50", border: "border-purple-200", label: "text-purple-700" },
  { bg: "bg-orange-50", border: "border-orange-200", label: "text-orange-700" },
  { bg: "bg-teal-50", border: "border-teal-200", label: "text-teal-700" },
  { bg: "bg-red-50", border: "border-red-200", label: "text-red-700" },
];

function CharacterCard({ character, index }: { character: CopyVideoCharacter; index: number }) {
  const [copied, setCopied] = useState(false);
  const colors = CHARACTER_COLORS[index % CHARACTER_COLORS.length];

  const handleCopy = () => {
    const text = `${character.name}\n${character.description}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`relative rounded-xl border ${colors.border} ${colors.bg} p-4`}>
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded cursor-pointer border-0 bg-transparent"
        title="Copy character"
      >
        {copied ? (
          <RiCheckLine className="text-base text-green-500" />
        ) : (
          <RiFileCopyLine className="text-base" />
        )}
      </button>

      {/* Label */}
      <p className={`text-xs font-bold ${colors.label} uppercase tracking-widest mb-1`}>
        Character {index + 1}
      </p>

      {/* Name */}
      <p className="text-sm font-bold text-gray-800 mb-1">{character.name}</p>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed pr-6">{character.description}</p>
    </div>
  );
}

interface CastSectionProps {
  scriptData: CopyVideoAnalysisData;
  /** Optional section title override */
  title?: string;
}

export function CastSection({ scriptData, title }: CastSectionProps) {
  const { t } = useTranslation();
  const characters = scriptData?.characters || [];
  const props = scriptData?.props || [];

  if (characters.length === 0 && props.length === 0) return null;

  return (
    <div className="mb-4">
      {/* ── Characters Section ── */}
      {characters.length > 0 && (
        <>
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <RiUser3Fill className="text-primary text-lg" />
              <h3 className="text-base font-bold text-gray-800">
                {title ?? t("Nhân Vật Phân Tích")} ({characters.length})
              </h3>
            </div>
          </div>

          {/* Character cards grid */}
          <div className="grid grid-cols-1  gap-3 mb-4">
            {characters.map((char, i) => (
              <CharacterCard key={`${char.name}-${i}`} character={char} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
