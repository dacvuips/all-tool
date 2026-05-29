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
import { SceneScript } from "../../constants";

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
  const { t } = useTranslation();
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
    <div className={`overflow-hidden rounded-xl border border-gray-200`}>
      {/* Block header */}
      <div className={`flex justify-between items-center px-3 py-2 ${headerColor}`}>
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-bold tracking-wide uppercase">{label}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex gap-1 items-center text-xs font-medium bg-transparent border-0 opacity-70 transition-opacity cursor-pointer hover:opacity-100"
        >
          <RiFileCopyLine className="text-xs" />
          {copied ? "✓ Đã copy" : "Copy"}
        </button>
      </div>

      {/* Block content */}
      <div className="bg-white">
        <div
          ref={contentRef}
          className="relative px-3 py-3"
          style={{
            maxHeight: !noCollapse && collapsed && isOverflow ? `${COLLAPSED_HEIGHT}px` : undefined,
            overflow: !noCollapse && collapsed && isOverflow ? "hidden" : undefined,
            transition: "max-height 0.3s ease",
          }}
        >
          {type === "dialogue" ? (
            <p className="text-sm italic leading-relaxed text-gray-700">{content}</p>
          ) : (
            <p className="text-xs leading-relaxed text-gray-600">
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
              className="absolute right-0 bottom-0 left-0 pointer-events-none"
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
                {t("Xem thêm")} <RiArrowDownSLine className="text-sm" />
              </>
            ) : (
              <>
                {t("Thu gọn")} <RiArrowUpSLine className="text-sm" />
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
    <div className="overflow-hidden mb-4 bg-gray-50 rounded-2xl border">
      {/* Scene header */}
      <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex gap-2 items-center">
          <span className="px-3 py-1 text-xs font-bold text-white bg-gray-800 rounded-full">
            {t("Cảnh")} #{scene.sceneNumber}
          </span>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${shotColorClass}`}>
            ● {scene.camera}
          </span>
        </div>
      </div>

      {/* Prompt blocks */}
      <div className="p-3 space-y-3">
        {/* IMAGE GEN PROMPT */}
        {scene.imageGenPrompt && (
          <PromptBlock
            type="image"
            label="IMAGE GEN PROMPT (STATIC)"
            content={scene.imageGenPrompt}
            icon={<RiImageFill className="text-xs text-orange-500" />}
            headerColor="bg-info-light text-info-dark"
          />
        )}

        {/* MOTION PROMPT */}
        <PromptBlock
          type="motion"
          label="MOTION PROMPT (VIDEO GEN)"
          content={scene.motionPrompt}
          icon={<RiVideoFill className="text-xs text-teal-500" />}
          headerColor="bg-pink-100 text-pink-700"
        />

        {/* DIALOGUE */}
        <PromptBlock
          type="dialogue"
          label="LỜI THOẠI / SUBTITLE"
          content={scene.dialogue}
          icon={<MdRecordVoiceOver className="text-xs text-green-500" />}
          headerColor="bg-green-50 text-green-700"
          noCollapse
        />
      </div>
    </div>
  );
}
