/**
 * scene-card.tsx
 * Individual scene card with Image Gen Prompt, Motion Prompt, Dialogue
 * className only – Tailwind CSS, light theme
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver } from "react-icons/md";
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiFileCopyLine,
  RiImageFill,
  RiVideoFill,
} from "react-icons/ri";
import { SceneScript } from "../constants";

// ── Camera shot color map ────────────────────────────────────────────────
const SHOT_COLORS: Record<string, string> = {
  "LOW ANGLE SHOT": "bg-green-100 text-green-700 border-green-200",
  "OVER-THE-SHOULDER TRACKING SHOT": "bg-purple-100 text-purple-700 border-purple-200",
  "MACRO EXTREME CLOSE-UP": "bg-teal-100 text-teal-700 border-teal-200",
  "POV SHOT": "bg-blue-100 text-blue-700 border-blue-200",
  "WIDE SHOT": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "CLOSE-UP": "bg-pink-100 text-pink-700 border-pink-200",
  "TWO-SHOT": "bg-orange-100 text-orange-700 border-orange-200",
};

const COLLAPSED_HEIGHT = 60; // px

// ── Reusable PromptBlock ─────────────────────────────────────────────────
function PromptBlock({
  type,
  label,
  content,
  icon,
  headerColor,
  noCollapse,
}: {
  type: "image" | "motion" | "dialogue" | "visualPrompt";
  label: string;
  content: string;
  icon: React.ReactNode;
  headerColor: string;
  noCollapse?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(!noCollapse);
  const [isOverflow, setIsOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setIsOverflow(contentRef.current.scrollHeight > COLLAPSED_HEIGHT);
    }
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`rounded-xl border border-gray-200 overflow-hidden`}>
      {/* Block header */}
      <div className={`flex items-center justify-between px-3 py-2 ${headerColor}`}>
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 cursor-pointer border-0 bg-transparent transition-opacity"
        >
          <RiFileCopyLine className="text-xs" />
          {copied ? "✓ Đã copy" : "Copy"}
        </button>
      </div>

      {/* Block content */}
      <div className="bg-white">
        <div
          ref={contentRef}
          className="px-3 py-3 relative"
          style={{
            maxHeight: !noCollapse && collapsed && isOverflow ? `${COLLAPSED_HEIGHT}px` : undefined,
            overflow: !noCollapse && collapsed && isOverflow ? "hidden" : undefined,
            transition: "max-height 0.3s ease",
          }}
        >
          {type === "dialogue" ? (
            <p className="text-sm text-gray-700 leading-relaxed italic">{content}</p>
          ) : (
            <p className="text-xs text-gray-600 leading-relaxed">
              {type === "image"
                ? content?.split(", ").map((part, i, arr) => {
                    const isKeyword = [
                      "Gender",
                      "Age",
                      "Ethnicity",
                      "Skin tone",
                      "Hair",
                      "Eyes",
                      "Face",
                      "Body",
                      "Clothing",
                      "Distinctive features",
                      "Setting",
                    ].some((k) => part.startsWith(k));
                    return (
                      <span key={i}>
                        {isKeyword ? (
                          <span className="text-blue-600">{part}</span>
                        ) : (
                          <span>{part}</span>
                        )}
                        {i < arr.length - 1 ? ", " : ""}
                      </span>
                    );
                  })
                : content}
            </p>
          )}

          {/* Gradient fade overlay when collapsed */}
          {!noCollapse && collapsed && isOverflow && (
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none"
              style={{
                height: "32px",
                background: "linear-gradient(transparent, white)",
              }}
            />
          )}
        </div>

        {/* Toggle button */}
        {!noCollapse && isOverflow && (
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer border-0 border-t border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            {collapsed ? (
              <>
                Xem thêm <RiArrowDownSLine className="text-sm" />
              </>
            ) : (
              <>
                Thu gọn <RiArrowUpSLine className="text-sm" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── SceneCard ────────────────────────────────────────────────────────────
interface SceneCardProps {
  scene: SceneScript;
}

export function SceneCard({ scene }: SceneCardProps) {
  const shotColorClass = SHOT_COLORS[scene.camera] || "bg-gray-100 text-gray-600 border-gray-200";
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border bg-gray-50 overflow-hidden mb-4">
      {/* Scene header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-800 text-white">
            {t("Cảnh")} #{scene.sceneNumber}
          </span>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${shotColorClass}`}>
            ● {scene.camera}
          </span>
        </div>
      </div>

      {/* Prompt blocks */}
      <div className="p-3 space-y-3 ">
        {/* IMAGE GEN PROMPT */}
        <PromptBlock
          type="image"
          label="IMAGE GEN PROMPT (STATIC)"
          content={scene.imageGenPrompt}
          icon={<RiImageFill className="text-orange-500 text-xs" />}
          headerColor="bg-info-light text-info-dark"
        />

        {/* MOTION PROMPT */}
        <PromptBlock
          type="motion"
          label="MOTION PROMPT (VIDEO GEN)"
          content={scene.motionPrompt}
          icon={<RiVideoFill className="text-teal-500 text-xs" />}
          headerColor="bg-pink-100 text-pink-700"
        />

        {/* DIALOGUE */}
        <PromptBlock
          type="dialogue"
          label="LỜI THOẠI / SUBTITLE"
          content={scene.dialogue}
          icon={<MdRecordVoiceOver className="text-green-500 text-xs" />}
          headerColor="bg-green-50 text-green-700"
          noCollapse
        />
      </div>
    </div>
  );
}
