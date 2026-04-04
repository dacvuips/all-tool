/**
 * cast-section.tsx
 * Dàn Nhân Vật (Cast) component – light theme
 * className only – Tailwind CSS
 */
import { RiUser3Fill } from "react-icons/ri";
import { ScriptData } from "../constants";

interface CastSectionProps {
  scriptData: ScriptData;
  /** Optional section title override */
  title?: string;
}

export function CastSection({ scriptData, title }: CastSectionProps) {
  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiUser3Fill className="text-gray-500 text-base" />
          <h3 className="text-base font-bold text-gray-800">{title ?? scriptData.topicTitle}</h3>
        </div>
        {scriptData.artStyle && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-600 border border-orange-200">
            {scriptData.artStyle}
          </span>
        )}
      </div>
    </div>
  );
}
