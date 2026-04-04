/**
 * cast-section.tsx
 * Dàn Nhân Vật (Cast) component – light theme
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { RiCheckLine, RiFileCopyLine, RiUser3Fill } from "react-icons/ri";
import { ScriptData } from "../constants";

interface CastSectionProps {
  scriptData: ScriptData;
  /** Optional section title override */
  title?: string;
}

export function CastSection({ scriptData, title }: CastSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `${scriptData.characterName}\n${scriptData.characterBaseDescription}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiUser3Fill className="text-primary text-lg" />
          <h3 className="text-base font-bold text-gray-800">{title ?? "Dàn Nhân Vật (Cast)"}</h3>
        </div>
        {scriptData.artStyle && (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-warning-light text-warning-dark border border-warning-200 uppercase tracking-wide whitespace-nowrap">
            {scriptData.artStyle}
          </span>
        )}
      </div>

      {/* Character card */}
      {scriptData.characterName && (
        <div className="relative rounded-xl border border-warning-200 bg-yellow-50 p-4">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
            title="Copy character"
          >
            {copied ? (
              <RiCheckLine className="text-base text-green-500" />
            ) : (
              <RiFileCopyLine className="text-base" />
            )}
          </button>

          {/* Label */}
          <p className="text-xs font-bold text-warning-dark uppercase tracking-widest mb-1">
            Character 1
          </p>

          {/* Name */}
          <p className="text-sm font-bold text-gray-800 mb-1">{scriptData.characterName}</p>

          {/* Tag */}
          {scriptData.voiceTone && (
            <p className="text-xs text-gray-400 italic mb-2">Tag: {scriptData.voiceTone}</p>
          )}

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed pr-6">
            {scriptData.characterBaseDescription}
          </p>
        </div>
      )}
    </div>
  );
}
