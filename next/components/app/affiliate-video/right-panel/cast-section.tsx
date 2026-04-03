/**
 * cast-section.tsx
 * Dàn Nhân Vật (Cast) component – light theme
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { RiFileCopyLine, RiUser3Fill } from "react-icons/ri";
import { CharacterItem, ScriptData } from "../constants";

interface CastSectionProps {
  scriptData: ScriptData;
}

function CharacterCard({ character }: { character: CharacterItem }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(character.description);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Character header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">
            CHARACTER {character.number}
          </div>
          <div className="text-base font-bold text-gray-800">{character.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">Tag: {character.tag}</div>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer border-0 bg-transparent"
          title="Copy description"
        >
          <RiFileCopyLine className="text-sm" />
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 leading-relaxed">
        {character.description.split(", ").slice(0, 8).map((part, i, arr) => {
          const isKeyword = ["Gender", "Age", "Ethnicity", "Skin tone", "Hair", "Eyes", "Face", "Body", "Clothing", "Distinctive features"].some(
            (k) => part.startsWith(k)
          );
          return (
            <span key={i}>
              {isKeyword ? (
                <>
                  <span className="font-medium text-gray-500">{part.split(":")[0]}:</span>
                  <span className="text-blue-600">{part.includes(":") ? part.slice(part.indexOf(":") + 1) : ""}</span>
                </>
              ) : (
                <span>{part}</span>
              )}
              {i < arr.length - 1 ? ", " : ""}
            </span>
          );
        })}
      </p>

      {copied && (
        <div className="mt-2 text-xs text-green-500 font-medium">✓ Đã sao chép!</div>
      )}
    </div>
  );
}

export function CastSection({ scriptData }: CastSectionProps) {
  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiUser3Fill className="text-gray-500 text-base" />
          <h3 className="text-base font-bold text-gray-800">{scriptData.title}</h3>
        </div>
        {scriptData.tag && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-600 border border-orange-200">
            {scriptData.tag}
          </span>
        )}
      </div>

      {/* Character cards */}
      <div className="space-y-3">
        {scriptData.characters.map((char) => (
          <CharacterCard key={char.id} character={char} />
        ))}
      </div>
    </div>
  );
}
