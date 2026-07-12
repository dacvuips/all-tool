import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiCog,
  HiDownload,
  HiMusicNote,
  HiOutlinePhotograph,
  HiOutlineX,
  HiPlay,
  HiUpload,
} from "react-icons/hi";
import {
  RiDeleteBinLine,
  RiFileDownloadLine,
  RiFlaskLine,
  RiRefreshLine,
  RiSave3Line,
  RiSettings4Line,
  RiVideoAddLine,
} from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import { loadGenerateVideoConfig, saveGenerateVideoConfig } from "../storage";
import {
  DEFAULT_GENERATE_VIDEO_CONFIG,
  GenerateVideoConfig,
  ManagedOption,
  PromptTemplateField,
  buildActivePromptFromConfig,
  buildCheckTotalPrompt,
  buildDialoguePrompt,
  getDefaultPrompt,
} from "../types";
import { CharacterProfileManagerDialog } from "./character-profile-manager-dialog";

type PromptKey = Exclude<
  keyof GenerateVideoConfig["prompts"],
  "directives" | "dialogueSystem" | "dialogueSection1" | "dialogueSectionLast"
>;

const PROMPT_BUTTONS: {
  key: PromptKey;
  label: string;
  style: React.CSSProperties;
}[] = [
  { key: "rulesNegative", label: "Rules Negative Prompt", style: { background: "#4B5563" } },
  { key: "dialogue", label: "Prompt Tạo Thoại", style: { background: "#D97706" } },
  { key: "checkTotal", label: "Check Prompt Tổng", style: { background: "#059669" } },
  { key: "image", label: "Prompt Tạo Ảnh", style: { background: "#0284C7" } },
];

function PromptFieldResetButton({
  field,
  onReset,
}: {
  field: PromptTemplateField;
  onReset: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onReset(getDefaultPrompt(field))}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-10 font-semibold text-gray-600 hover:bg-gray-50"
      title={t("Reset về prompt mẫu ({{field}})", { field })}
    >
      <RiRefreshLine />
      {t("Reset")}
    </button>
  );
}

const WORKFLOW_OPTIONS = [
  { value: "start-end", label: "Start & End" },
  { value: "start-only", label: "Start Only" },
  { value: "end-only", label: "End Only" },
  { value: "full", label: "Full Sequence" },
];

const VOICE_OPTIONS = [
  "Achernar",
  "Aoede",
  "Charon",
  "Fenrir",
  "Kore",
  "Leda",
  "Orus",
  "Puck",
  "Zephyr",
];

const POSITION_OPTIONS = [
  { value: "custom", label: "Tùy chỉnh" },
  { value: "top-left", label: "Trên trái" },
  { value: "top-right", label: "Trên phải" },
  { value: "bottom-left", label: "Dưới trái" },
  { value: "bottom-right", label: "Dưới phải" },
  { value: "center", label: "Giữa" },
];

const EFFECT_OPTIONS = [
  { value: "move", label: "Di Chuyển" },
  { value: "static", label: "Tĩnh" },
  { value: "fade", label: "Fade" },
  { value: "pulse", label: "Pulse" },
];

const DIALOGUE_OPTIONS = [
  { value: "keep", label: "Giữ Nguyên Thoại" },
  { value: "replace", label: "Thay Thế Thoại" },
  { value: "mute", label: "Tắt Thoại" },
  { value: "generate", label: "Tạo Thoại Mới" },
];

const IMAGE_MODEL_OPTIONS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
  { value: "nano-banana-2", label: "Nano Banana 2" },
  { value: "nano-banana", label: "Nano Banana" },
];

const VIDEO_MODEL_OPTIONS = [
  { value: "0-credit", label: "0 Credit (Lower Priority)" },
  { value: "fast", label: "Fast (Higher Priority)" },
  { value: "quality", label: "Quality" },
];

const fieldClass =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-800 outline-none focus:border-primary";

interface GenerateVideoConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndApply: (config: GenerateVideoConfig, promptForAll: string) => void;
}

function SectionCard({
  title,
  icon,
  accent,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}
    >
      <div
        className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5"
        style={{ background: `linear-gradient(90deg, ${accent}14, transparent)` }}
      >
        <span
          className="flex justify-center items-center w-7 h-7 text-sm text-white rounded-lg"
          style={{ background: accent }}
        >
          {icon}
        </span>
        <h3 className="m-0 text-xs font-bold tracking-wider text-gray-800 uppercase">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-center">
      <span className="w-28 text-xs font-medium text-gray-500 shrink-0 sm:w-32">{label}</span>
      <div className="flex flex-1 gap-2 items-center min-w-0">{children}</div>
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${fieldClass} ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function GenerateVideoConfigDialog({
  isOpen,
  onClose,
  onSaveAndApply,
}: GenerateVideoConfigDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const musicInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<GenerateVideoConfig>(DEFAULT_GENERATE_VIDEO_CONFIG);
  const [editingPrompt, setEditingPrompt] = useState<PromptKey | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [directivesDraft, setDirectivesDraft] = useState("");
  const [negativeDraft, setNegativeDraft] = useState("");
  const [dialogueSystemDraft, setDialogueSystemDraft] = useState("");
  const [dialogueSection1Draft, setDialogueSection1Draft] = useState("");
  const [dialogueSectionLastDraft, setDialogueSectionLastDraft] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [manageList, setManageList] = useState<
    "techniques" | "actionsV1" | "actionsV2" | null
  >(null);
  const [manageDraft, setManageDraft] = useState("");
  const [showCustomPos, setShowCustomPos] = useState(false);
  const [characterManagerOpen, setCharacterManagerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const loaded = await loadGenerateVideoConfig();
      if (cancelled) return;
      setConfig(loaded);
      setEditingPrompt(null);
      setPromptDraft("");
      setDirectivesDraft("");
      setNegativeDraft("");
      setDialogueSystemDraft("");
      setDialogueSection1Draft("");
      setDialogueSectionLastDraft("");
      setImportOpen(false);
      setImportText("");
      setManageList(null);
      setShowCustomPos(false);
      setCharacterManagerOpen(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const patch = (partial: Partial<GenerateVideoConfig>) => {
    setConfig((c) => ({ ...c, ...partial }));
  };

  const patchWatermark = (partial: Partial<GenerateVideoConfig["watermark"]>) => {
    setConfig((c) => ({ ...c, watermark: { ...c.watermark, ...partial } }));
  };

  const patchPrompt = (key: PromptKey, value: string) => {
    setConfig((c) => ({ ...c, prompts: { ...c.prompts, [key]: value } }));
  };

  const applyImportedJson = async (text: string) => {
    try {
      const parsed = JSON.parse(text) as Partial<GenerateVideoConfig>;
      const next = {
        ...DEFAULT_GENERATE_VIDEO_CONFIG,
        ...parsed,
        prompts: { ...DEFAULT_GENERATE_VIDEO_CONFIG.prompts, ...parsed.prompts },
        watermark: { ...DEFAULT_GENERATE_VIDEO_CONFIG.watermark, ...parsed.watermark },
        techniques: parsed.techniques?.length
          ? parsed.techniques
          : DEFAULT_GENERATE_VIDEO_CONFIG.techniques,
        characters: parsed.characters?.length
          ? parsed.characters
          : DEFAULT_GENERATE_VIDEO_CONFIG.characters,
        actionsV1: parsed.actionsV1?.length
          ? parsed.actionsV1
          : DEFAULT_GENERATE_VIDEO_CONFIG.actionsV1,
        actionsV2: parsed.actionsV2?.length
          ? parsed.actionsV2
          : DEFAULT_GENERATE_VIDEO_CONFIG.actionsV2,
      };
      setConfig(next);
      const saved = await saveGenerateVideoConfig(next);
      setConfig(saved);
      toast.success(t("Đã import template"));
      setImportOpen(false);
      setImportText("");
      return true;
    } catch {
      toast.error(t("File template không hợp lệ"));
      return false;
    }
  };

  const openPromptEditor = (key: PromptKey) => {
    setEditingPrompt(key);
    if (key === "rulesNegative") {
      setDirectivesDraft(config.prompts.directives || "");
      setNegativeDraft(config.prompts.rulesNegative || "");
      setPromptDraft("");
    } else if (key === "dialogue") {
      setDialogueSystemDraft(config.prompts.dialogueSystem || "");
      setDialogueSection1Draft(config.prompts.dialogueSection1 || "");
      setDialogueSectionLastDraft(config.prompts.dialogueSectionLast || "");
      setPromptDraft("");
    } else if (key === "checkTotal") {
      // Chỉ xem — tổng hợp từ các prompt khác
      setPromptDraft(buildCheckTotalPrompt(config.prompts));
    } else {
      setPromptDraft(config.prompts[key] || "");
      setDirectivesDraft("");
      setNegativeDraft("");
    }
  };

  const closePromptEditor = () => {
    setEditingPrompt(null);
    setPromptDraft("");
    setDirectivesDraft("");
    setNegativeDraft("");
    setDialogueSystemDraft("");
    setDialogueSection1Draft("");
    setDialogueSectionLastDraft("");
  };

  const savePromptEditor = async () => {
    if (!editingPrompt || editingPrompt === "checkTotal") return;

    let nextPrompts = { ...config.prompts };

    if (editingPrompt === "rulesNegative") {
      nextPrompts = {
        ...nextPrompts,
        directives: directivesDraft,
        rulesNegative: negativeDraft,
        checkTotal: buildCheckTotalPrompt({
          ...nextPrompts,
          directives: directivesDraft,
          rulesNegative: negativeDraft,
        }),
      };
    } else if (editingPrompt === "dialogue") {
      const dialogue = buildDialoguePrompt(
        dialogueSystemDraft,
        dialogueSection1Draft,
        dialogueSectionLastDraft
      );
      nextPrompts = {
        ...nextPrompts,
        dialogueSystem: dialogueSystemDraft,
        dialogueSection1: dialogueSection1Draft,
        dialogueSectionLast: dialogueSectionLastDraft,
        dialogue,
        checkTotal: buildCheckTotalPrompt({
          ...nextPrompts,
          dialogueSystem: dialogueSystemDraft,
          dialogueSection1: dialogueSection1Draft,
          dialogueSectionLast: dialogueSectionLastDraft,
          dialogue,
        }),
      };
    } else {
      nextPrompts = {
        ...nextPrompts,
        [editingPrompt]: promptDraft,
        checkTotal: buildCheckTotalPrompt({
          ...nextPrompts,
          [editingPrompt]: promptDraft,
        }),
      };
    }

    const next = { ...config, prompts: nextPrompts };
    closePromptEditor();
    try {
      const saved = await saveGenerateVideoConfig(next);
      setConfig(saved);
      toast.success(
        editingPrompt === "rulesNegative"
          ? t("Đã lưu Rules Negative Prompt")
          : editingPrompt === "dialogue"
          ? t("Đã lưu Prompt Tạo Thoại")
          : t("Đã lưu prompt vào IndexedDB")
      );
    } catch (err) {
      console.error(err);
      setConfig(next);
      toast.error(t("Không lưu được prompt vào IndexedDB"));
    }
  };

  const handleExportTemplate = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generate-video-template-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("Đã export template"));
  };

  const handleMusicSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    patch({ musicName: file.name, musicUrl: url });
    toast.success(t("Đã chọn nhạc: {{name}}", { name: file.name }));
  };

  const handleLogoSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    patchWatermark({ logoUrl: url, mode: "logo" });
    toast.success(t("Đã chọn logo"));
  };

  const handlePlayVoice = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(`Xin chào, đây là giọng ${config.voice}`);
      u.lang = "vi-VN";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } else {
      toast.info(t("Trình duyệt không hỗ trợ phát thử giọng"));
    }
  };

  const handleQuickTest = () => {
    const prompt = buildActivePromptFromConfig(config);
    toast.success(t("Test nhanh OK — prompt {{len}} ký tự", { len: prompt.length }));
  };

  const handleCleanup = async () => {
    if (!confirm(t("Reset cấu hình generate video về mặc định?"))) return;
    try {
      const next = await saveGenerateVideoConfig({ ...DEFAULT_GENERATE_VIDEO_CONFIG });
      setConfig(next);
      toast.success(t("Đã dọn dẹp cấu hình"));
    } catch (err) {
      console.error(err);
      toast.error(t("Không lưu được cấu hình vào IndexedDB"));
    }
  };

  const handleSave = async () => {
    const checkTotal = buildCheckTotalPrompt(config.prompts);
    const activePrompt = buildActivePromptFromConfig(config);
    const next = {
      ...config,
      prompts: { ...config.prompts, checkTotal },
      activePrompt,
    };
    try {
      const saved = await saveGenerateVideoConfig(next);
      setConfig(saved);
      onSaveAndApply(saved, buildActivePromptFromConfig(saved));
      toast.success(t("Đã lưu setting (IndexedDB) và áp dụng prompt cho tất cả luồng"));
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t("Không lưu được setting vào IndexedDB"));
    }
  };

  const listKey = manageList;
  const managedItems: ManagedOption[] = listKey ? config[listKey] : [];

  const addManaged = () => {
    if (!listKey || !manageDraft.trim()) return;
    const item: ManagedOption = { id: crypto.randomUUID(), name: manageDraft.trim() };
    patch({ [listKey]: [...config[listKey], item] } as Partial<GenerateVideoConfig>);
    setManageDraft("");
  };

  const removeManaged = (id: string) => {
    if (!listKey) return;
    const next = config[listKey].filter((i) => i.id !== id);
    const idField =
      listKey === "techniques"
        ? "techniqueId"
        : listKey === "actionsV1"
        ? "actionV1Id"
        : "actionV2Id";
    const currentId = config[idField];
    patch({
      [listKey]: next,
      ...(currentId === id && next[0] ? { [idField]: next[0].id } : {}),
    } as Partial<GenerateVideoConfig>);
  };

  const promptLabels: Record<PromptKey, string> = {
    rulesNegative: "Rules Negative Prompt",
    dialogue: "Prompt Tạo Thoại",
    checkTotal: "Check Prompt Tổng",
    image: "Prompt Tạo Ảnh",
  };

  const manageTitles = {
    techniques: "Kỹ Thuật",
    actionsV1: "Action V1",
    actionsV2: "Action V2",
  };

  const filledPromptCount = PROMPT_BUTTONS.filter((btn) => {
    if (btn.key === "rulesNegative") {
      return !!(config.prompts.directives?.trim() || config.prompts.rulesNegative?.trim());
    }
    if (btn.key === "dialogue") {
      return !!(
        config.prompts.dialogueSystem?.trim() ||
        config.prompts.dialogueSection1?.trim() ||
        config.prompts.dialogueSectionLast?.trim() ||
        config.prompts.dialogue?.trim()
      );
    }
    if (btn.key === "checkTotal") {
      return !!buildCheckTotalPrompt(config.prompts).trim();
    }
    return !!config.prompts[btn.key]?.trim();
  }).length;

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        width="1080px"
        maxWidth="96vw"
        hasCloseIcon={false}
        slideFromBottom="none"
        wrapperClass="fixed w-full h-screen top-0 left-0 z-100 flex items-center justify-center overflow-hidden p-4"
        dialogClass="relative bg-white shadow-md rounded-2xl m-auto overflow-hidden flex flex-col"
        headerClass="relative flex items-center px-5 py-3 bg-white border-b border-gray-100 rounded-t-2xl z-10 shrink-0"
        bodyClass="relative p-0 bg-gray-50 overflow-hidden flex-1 min-h-0"
        footerClass="relative flex flex-wrap items-center gap-2 px-4 py-3 bg-white border-t border-gray-200 rounded-b-2xl shrink-0 z-10"
      >
        <Dialog.Header>
          <div className="flex flex-1 gap-3 items-center">
            <div
              className="flex justify-center items-center w-10 h-10 text-white rounded-xl shadow-sm"
              style={{ background: "linear-gradient(135deg, #F2890D, #C26E0B)" }}
            >
              <RiVideoAddLine className="text-xl" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-gray-900">
                {t("Cấu hình Generate Video")}
              </div>
              <div className="text-10 text-gray-500 mt-0.5">
                {t("Prompt áp dụng cho tất cả luồng · {{count}}/4 prompt đã điền", {
                  count: filledPromptCount,
                })}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex justify-center items-center w-8 h-8 text-gray-400 rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <HiOutlineX className="text-lg" />
          </button>
        </Dialog.Header>

        <Dialog.Body>
          <div
            className="overflow-y-auto p-4 space-y-4"
            style={{ maxHeight: "calc(90vh - 140px)" }}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Prompt */}
              <SectionCard title={t("Cấu Hình Prompt")} accent="#7C3AED" icon={<HiCog />}>
                <div className="grid grid-cols-2 gap-2">
                {PROMPT_BUTTONS.map((btn) => {
                  const filled =
                    btn.key === "rulesNegative"
                      ? !!(
                          config.prompts.directives?.trim() ||
                          config.prompts.rulesNegative?.trim()
                        )
                      : btn.key === "dialogue"
                      ? !!(
                          config.prompts.dialogueSystem?.trim() ||
                          config.prompts.dialogueSection1?.trim() ||
                          config.prompts.dialogueSectionLast?.trim() ||
                          config.prompts.dialogue?.trim()
                        )
                      : btn.key === "checkTotal"
                      ? !!buildCheckTotalPrompt(config.prompts).trim()
                      : !!config.prompts[btn.key]?.trim();
                  return (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => openPromptEditor(btn.key)}
                      style={btn.style}
                      className="relative rounded-lg px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90"
                    >
                      {t(btn.label)}
                      {filled && (
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-white border-2 border-emerald-500" />
                      )}
                    </button>
                  );
                })}
                  <button
                    type="button"
                    onClick={() => {
                      setImportText("");
                      setImportOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90"
                    style={{ background: "#7C3AED" }}
                  >
                    <HiDownload className="text-sm" />
                    {t("Import Template")}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportTemplate}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90"
                    style={{ background: "#4F46E5" }}
                  >
                    <HiUpload className="text-sm" />
                    {t("Export Template")}
                  </button>
                </div>
              </SectionCard>

              {/* Watermark */}
              <SectionCard
                title={t("Ghép Watermark")}
                accent="#0EA5E9"
                icon={<HiOutlinePhotograph />}
              >
                <div className="mb-3 inline-flex rounded-lg bg-gray-100 p-0.5">
                  {(["signature", "logo"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => patchWatermark({ mode })}
                      className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                        config.watermark.mode === mode
                          ? "bg-sky-500 text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {mode === "signature" ? t("Chữ Ký") : t("Logo")}
                    </button>
                  ))}
                </div>

                <div className="space-y-2.5">
                  {config.watermark.mode === "signature" ? (
                    <FieldRow label={t("Chữ Ký (Text)")}>
                      <input
                        className={fieldClass}
                        value={config.watermark.text}
                        onChange={(e) => patchWatermark({ text: e.target.value })}
                      />
                    </FieldRow>
                  ) : (
                    <FieldRow label={t("Logo")}>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleLogoSelect(f);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="flex-1 px-3 h-9 text-xs text-left text-gray-500 bg-gray-50 rounded-lg border border-gray-300 border-dashed hover:border-sky-400 hover:bg-sky-50"
                      >
                        {config.watermark.logoUrl
                          ? t("Đã chọn logo (đổi)")
                          : t("Chọn file logo...")}
                      </button>
                    </FieldRow>
                  )}

                  <FieldRow label={t("Kích Cỡ (px)")}>
                    <input
                      type="number"
                      className={fieldClass}
                      value={config.watermark.size}
                      onChange={(e) => patchWatermark({ size: Number(e.target.value) || 0 })}
                    />
                  </FieldRow>

                  <FieldRow label={t("Vị Trí")}>
                    <NativeSelect
                      value={config.watermark.position}
                      onChange={(v) => patchWatermark({ position: v })}
                      options={POSITION_OPTIONS}
                    />
                  </FieldRow>

                  <FieldRow label={t("Hiệu Ứng")}>
                    <NativeSelect
                      value={config.watermark.effect}
                      onChange={(v) => patchWatermark({ effect: v })}
                      options={EFFECT_OPTIONS}
                    />
                  </FieldRow>

                  <FieldRow label={t("Opacity")}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config.watermark.opacity}
                      onChange={(e) => patchWatermark({ opacity: Number(e.target.value) })}
                      className="flex-1 h-2 accent-sky-500"
                    />
                    <span className="w-8 text-xs font-semibold text-right text-gray-600">
                      {config.watermark.opacity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomPos((v) => !v)}
                      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      <HiCog className="text-gray-400" />
                      {t("Vị Trí Tùy Chỉnh")}
                    </button>
                  </FieldRow>

                  {showCustomPos && (
                    <div className="flex gap-2 sm:pl-32">
                      <input
                        type="number"
                        className={fieldClass}
                        value={config.watermark.customX}
                        onChange={(e) => patchWatermark({ customX: Number(e.target.value) || 0 })}
                        placeholder="X %"
                      />
                      <input
                        type="number"
                        className={fieldClass}
                        value={config.watermark.customY}
                        onChange={(e) => patchWatermark({ customY: Number(e.target.value) || 0 })}
                        placeholder="Y %"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 items-center pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        patchWatermark({
                          stickerCount: Math.max(0, config.watermark.stickerCount + 1),
                        })
                      }
                      className="px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:opacity-90"
                      style={{ background: "#DB2777" }}
                    >
                      {config.watermark.stickerCount} Sticker
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info(t("Ghép thủ công — mở editor (mô phỏng)"))}
                      className="px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:opacity-90"
                      style={{ background: "#059669" }}
                    >
                      {t("Ghép Thủ Công")}
                    </button>
                    <div className="flex gap-2 items-center ml-auto">
                      <span className="text-xs font-medium text-gray-500">FFmpeg</span>
                      <NativeSelect
                        value={String(config.watermark.ffmpegThreads)}
                        onChange={(v) => patchWatermark({ ffmpegThreads: Number(v) || 1 })}
                        options={[1, 2, 4, 8].map((n) => ({
                          value: String(n),
                          label: String(n),
                        }))}
                        className="w-16"
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Video */}
              <SectionCard title={t("Cấu Hình Video")} accent="#F2890D" icon={<RiVideoAddLine />}>
                <div className="space-y-2.5">
                  <FieldRow label="WorkFlow">
                    <NativeSelect
                      value={config.workflow}
                      onChange={(v) => patch({ workflow: v })}
                      options={WORKFLOW_OPTIONS}
                    />
                  </FieldRow>

                  <FieldRow label="Voice">
                    <NativeSelect
                      value={config.voice}
                      onChange={(v) => patch({ voice: v })}
                      options={VOICE_OPTIONS.map((v) => ({ value: v, label: v }))}
                    />
                    <button
                      type="button"
                      onClick={handlePlayVoice}
                      className="inline-flex gap-1 items-center px-3 h-9 text-xs font-semibold text-white bg-gray-800 rounded-lg shrink-0 hover:bg-gray-700"
                    >
                      <HiPlay />
                      {t("Play")}
                    </button>
                  </FieldRow>

                  <FieldRow label={t("Kỹ Thuật")}>
                    <NativeSelect
                      value={config.techniqueId}
                      onChange={(v) => patch({ techniqueId: v })}
                      options={config.techniques.map((o) => ({
                        value: o.id,
                        label: o.name,
                      }))}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setManageList("techniques");
                        setManageDraft("");
                      }}
                      className="px-3 h-9 text-xs font-semibold rounded-lg border border-opacity-30 shrink-0 border-primary bg-primary-light text-primary-dark hover:bg-primary hover:bg-opacity-10"
                    >
                      {t("Quản lý")}
                    </button>
                  </FieldRow>

                  <FieldRow label={t("Nhân Vật")}>
                    <NativeSelect
                      value={config.characterId}
                      onChange={(v) => patch({ characterId: v })}
                      options={config.characters.map((o) => ({
                        value: o.id,
                        label: o.name,
                      }))}
                    />
                    <button
                      type="button"
                      onClick={() => setCharacterManagerOpen(true)}
                      className="px-3 h-9 text-xs font-semibold rounded-lg border border-opacity-30 shrink-0 whitespace-nowrap border-primary bg-primary-light text-primary-dark hover:bg-primary hover:bg-opacity-10"
                    >
                      {t("Quản lý")}
                    </button>
                  </FieldRow>

                  {(
                    [
                      {
                        label: "Action V1",
                        list: "actionsV1" as const,
                        id: config.actionV1Id,
                        setId: (v: string) => patch({ actionV1Id: v }),
                      },
                      {
                        label: "Action V2",
                        list: "actionsV2" as const,
                        id: config.actionV2Id,
                        setId: (v: string) => patch({ actionV2Id: v }),
                      },
                    ] as const
                  ).map((row) => (
                    <FieldRow key={row.list} label={t(row.label)}>
                      <NativeSelect
                        value={row.id}
                        onChange={row.setId}
                        options={config[row.list].map((o) => ({
                          value: o.id,
                          label: o.name,
                        }))}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setManageList(row.list);
                          setManageDraft("");
                        }}
                        className="px-3 h-9 text-xs font-semibold rounded-lg border border-opacity-30 shrink-0 border-primary bg-primary-light text-primary-dark hover:bg-primary hover:bg-opacity-10"
                      >
                        {t("Quản lý")}
                      </button>
                    </FieldRow>
                  ))}
                </div>

                {manageList && (
                  <div className="p-3 mt-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-orange-700">
                        {t("Quản lý")} {t(manageTitles[manageList])}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-medium text-orange-500 hover:text-orange-700"
                        onClick={() => setManageList(null)}
                      >
                        {t("Đóng")}
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        className={fieldClass}
                        value={manageDraft}
                        onChange={(e) => setManageDraft(e.target.value)}
                        placeholder={t("Tên mới...")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addManaged();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={addManaged}
                        className="px-3 h-9 text-xs font-semibold text-white rounded-lg shrink-0 bg-primary hover:bg-primary-dark"
                      >
                        {t("Thêm")}
                      </button>
                    </div>
                    <ul className="overflow-y-auto p-0 m-0 space-y-1 max-h-32 list-none">
                      {managedItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between rounded-md bg-white border border-orange-100 px-2.5 py-1.5 text-xs text-gray-700"
                        >
                          <span className="font-medium">{item.name}</span>
                          <button
                            type="button"
                            onClick={() => removeManaged(item.id)}
                            className="text-rose-400 hover:text-rose-600"
                          >
                            <RiDeleteBinLine />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </SectionCard>

              {/* Audio */}
              <SectionCard title={t("Cấu Hình Âm Thanh")} accent="#8B5CF6" icon={<HiMusicNote />}>
                <div className="space-y-3">
                  <FieldRow label={t("Lời Thoại")}>
                    <NativeSelect
                      value={config.dialogueMode}
                      onChange={(v) => patch({ dialogueMode: v })}
                      options={DIALOGUE_OPTIONS}
                    />
                  </FieldRow>

                  <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 border-dashed">
                    <div className="flex gap-3 items-center">
                      <input
                        ref={musicInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleMusicSelect(f);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => musicInputRef.current?.click()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white shadow-sm hover:opacity-90"
                        style={{ background: "#7C3AED" }}
                      >
                        <HiMusicNote />
                        {t("Thêm Nhạc")}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-700 truncate">
                          {config.musicName || t("Chưa chọn nhạc")}
                        </div>
                        {!config.musicName && (
                          <div className="text-gray-400 text-10">
                            {t("Hỗ trợ mp3, wav, m4a...")}
                          </div>
                        )}
                      </div>
                      {config.musicName && (
                        <button
                          type="button"
                          onClick={() => patch({ musicName: "", musicUrl: "" })}
                          className="text-xs font-semibold text-rose-500 hover:underline"
                        >
                          {t("Xóa")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* General */}
            <SectionCard title={t("Cấu Hình Tổng Thể")} accent="#0D9488" icon={<RiSettings4Line />}>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2.5">
                  <p className="m-0 mb-1 font-bold tracking-wider text-teal-600 uppercase text-10">
                    {t("Mô Hình")}
                  </p>
                  <FieldRow label={t("Mô Hình Ảnh")}>
                    <NativeSelect
                      value={config.imageModel}
                      onChange={(v) => patch({ imageModel: v })}
                      options={IMAGE_MODEL_OPTIONS}
                    />
                  </FieldRow>
                  <FieldRow label={t("Mô Hình Video")}>
                    <NativeSelect
                      value={config.videoModel}
                      onChange={(v) => patch({ videoModel: v })}
                      options={VIDEO_MODEL_OPTIONS}
                    />
                  </FieldRow>
                </div>

                <div className="space-y-2.5">
                  <p className="m-0 mb-1 font-bold tracking-wider text-teal-600 uppercase text-10">
                    {t("Cài Đặt")}
                  </p>
                  <FieldRow label={t("Số video mỗi job")}>
                    <NativeSelect
                      value={String(Math.min(4, Math.max(1, config.videosPerJob || 1)))}
                      onChange={(v) => patch({ videosPerJob: Math.min(4, Math.max(1, Number(v) || 1)) })}
                      options={[1, 2, 3, 4].map((n) => ({
                        value: String(n),
                        label: String(n),
                      }))}
                    />
                  </FieldRow>
                  <FieldRow label={t("Số luồng video chạy song song")}>
                    <NativeSelect
                      value={String(config.threadCount)}
                      onChange={(v) => patch({ threadCount: Number(v) })}
                      options={Array.from({ length: 50 }, (_, i) => {
                        const n = i + 1;
                        return { value: String(n), label: String(n) };
                      })}
                    />
                  </FieldRow>
                </div>
              </div>
            </SectionCard>
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <button
            type="button"
            onClick={handleQuickTest}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
            style={{ background: "#0D9488" }}
          >
            <RiFlaskLine />
            {t("Test Nhanh")}
          </button>
          <button
            type="button"
            onClick={handleExportTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
            style={{ background: "#D97706" }}
          >
            <RiFileDownloadLine />
            {t("Xuất File")}
          </button>
          <button
            type="button"
            onClick={handleCleanup}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
            style={{ background: "#EA580C" }}
          >
            <RiDeleteBinLine />
            {t("Dọn Dẹp")}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            {t("Hủy")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #0284C7, #0369A1)" }}
          >
            <RiSave3Line />
            {t("Lưu Setting")}
          </button>
        </Dialog.Footer>
      </Dialog>

      {/* Prompt editor dialog */}
      <Dialog
        isOpen={!!editingPrompt}
        onClose={closePromptEditor}
        title={editingPrompt ? t(promptLabels[editingPrompt]) : ""}
        width={
          editingPrompt === "rulesNegative" ||
          editingPrompt === "dialogue" ||
          editingPrompt === "checkTotal"
            ? "720px"
            : "560px"
        }
        slideFromBottom="none"
        wrapperClass="fixed w-full h-screen top-0 left-0 z-100 flex items-center justify-center overflow-hidden p-4"
      >
        <Dialog.Body>
          {editingPrompt === "rulesNegative" ? (
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {t("Directives")}{" "}
                    <span className="text-gray-400 font-normal">
                      ({t("Mỗi dòng 1 chỉ thị")} · {t("Nên làm")})
                    </span>
                  </label>
                  <PromptFieldResetButton
                    field="directives"
                    onReset={(v) => setDirectivesDraft(v)}
                  />
                </div>
                <textarea
                  value={directivesDraft}
                  onChange={(e) => setDirectivesDraft(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary"
                  placeholder={t("Mỗi dòng một chỉ thị nên làm...")}
                  autoFocus
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {t("Negative Prompt")}{" "}
                    <span className="text-gray-400 font-normal">
                      ({t("Mỗi dòng 1 chỉ thị")} · {t("Không nên làm")})
                    </span>
                  </label>
                  <PromptFieldResetButton
                    field="rulesNegative"
                    onReset={(v) => setNegativeDraft(v)}
                  />
                </div>
                <textarea
                  value={negativeDraft}
                  onChange={(e) => setNegativeDraft(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary"
                  placeholder={t("Mỗi dòng một chỉ thị không nên làm...")}
                />
              </div>
              <p className="m-0 text-gray-500 text-10">
                {t("Nội dung sẽ được tổng hợp vào Check Prompt Tổng (chỉ xem).")}
              </p>
            </div>
          ) : editingPrompt === "dialogue" ? (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {t("System Instruction")}{" "}
                    <span className="text-gray-400 font-normal">
                      ({t("Vai trò & Luật lệ")})
                    </span>
                  </label>
                  <PromptFieldResetButton
                    field="dialogueSystem"
                    onReset={(v) => setDialogueSystemDraft(v)}
                  />
                </div>
                <textarea
                  value={dialogueSystemDraft}
                  onChange={(e) => setDialogueSystemDraft(e.target.value)}
                  rows={7}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary"
                  placeholder={t("Nhập system instruction...")}
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("User Prompt")}{" "}
                  <span className="text-gray-400 font-normal">
                    ({t("2 Thoại — mỗi tab là 1 section")})
                  </span>
                </label>
                <TabGroup
                  name="dialogue-prompt-sections"
                  flex={false}
                  tabClassName="px-4 py-2"
                  titleClassName="text-xs font-semibold whitespace-nowrap"
                  bodyClassName="pt-3"
                  className="border-b border-gray-200"
                >
                  <TabGroup.Tab label={t("Thoại 1")}>
                    <div className="mb-1.5 flex justify-end">
                      <PromptFieldResetButton
                        field="dialogueSection1"
                        onReset={(v) => setDialogueSection1Draft(v)}
                      />
                    </div>
                    <textarea
                      value={dialogueSection1Draft}
                      onChange={(e) => setDialogueSection1Draft(e.target.value)}
                      rows={8}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary"
                      placeholder={t("Thoại 1 — Hook + Giới thiệu sản phẩm...")}
                    />
                  </TabGroup.Tab>
                  <TabGroup.Tab label={t("Thoại Cuối")}>
                    <div className="mb-1.5 flex justify-end">
                      <PromptFieldResetButton
                        field="dialogueSectionLast"
                        onReset={(v) => setDialogueSectionLastDraft(v)}
                      />
                    </div>
                    <textarea
                      value={dialogueSectionLastDraft}
                      onChange={(e) => setDialogueSectionLastDraft(e.target.value)}
                      rows={8}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary"
                      placeholder={t("Thoại Cuối — CTA / kết thúc...")}
                    />
                  </TabGroup.Tab>
                </TabGroup>
              </div>
            </div>
          ) : editingPrompt === "checkTotal" ? (
            <div className="space-y-2">
              <p className="m-0 text-xs text-gray-500">
                {t("Tổng hợp từ Rules / Prompt Tạo Thoại / Prompt Tạo Ảnh — chỉ xem, không sửa.")}
              </p>
              <pre className="m-0 max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800">
                {promptDraft.trim() || t("Chưa có prompt nào được cấu hình.")}
              </pre>
            </div>
          ) : (
            <>
              <div className="mb-1.5 flex justify-end">
                <PromptFieldResetButton
                  field="image"
                  onReset={(v) => setPromptDraft(v)}
                />
              </div>
              <textarea
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary"
                placeholder={t("Nhập prompt...")}
                autoFocus
              />
              <p className="m-0 mt-2 text-gray-500 text-10">
                {t("Sẽ được gộp vào Check Prompt Tổng khi Lưu.")}
              </p>
            </>
          )}
          <div className="mt-4 flex gap-2 justify-end">
            <button
              type="button"
              onClick={closePromptEditor}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-gray-600 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              {editingPrompt === "checkTotal" ? t("Đóng") : t("Hủy")}
            </button>
            {editingPrompt !== "checkTotal" && (
              <button
                type="button"
                onClick={savePromptEditor}
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white rounded-lg bg-primary hover:bg-primary-dark"
              >
                {t("Lưu")}
              </button>
            )}
          </div>
        </Dialog.Body>
      </Dialog>

      {/* Import template dialog */}
      <Dialog
        isOpen={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportText("");
        }}
        title={t("Import Template")}
        width="560px"
        slideFromBottom="none"
        wrapperClass="fixed w-full h-screen top-0 left-0 z-100 flex items-center justify-center overflow-hidden p-4"
      >
        <Dialog.Body>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                {t("Chọn file JSON")}
              </label>
              <input
                type="file"
                accept=".json,application/json"
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-700 hover:file:bg-violet-100"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const text = await f.text();
                  setImportText(text);
                  e.target.value = "";
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                {t("Hoặc dán nội dung JSON")}
              </label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={10}
                className="px-3 py-2 w-full font-mono text-xs text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-primary"
                placeholder='{ "prompts": { ... }, "workflow": "start-end", ... }'
              />
            </div>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <button
            type="button"
            onClick={() => {
              setImportOpen(false);
              setImportText("");
            }}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold text-gray-600 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            {t("Hủy")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!importText.trim()) {
                toast.warn(t("Chưa có nội dung template"));
                return;
              }
              applyImportedJson(importText);
            }}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white rounded-lg hover:opacity-90"
            style={{ background: "#7C3AED" }}
          >
            {t("Import")}
          </button>
        </Dialog.Footer>
      </Dialog>

      <CharacterProfileManagerDialog
        isOpen={characterManagerOpen}
        onClose={() => setCharacterManagerOpen(false)}
        profiles={config.characters}
        selectedId={config.characterId}
        onChange={async (profiles, selectedId) => {
          const next = {
            ...config,
            characters: profiles,
            characterId: selectedId,
          };
          try {
            const saved = await saveGenerateVideoConfig(next);
            setConfig(saved);
          } catch (err) {
            console.error(err);
            setConfig(next);
            toast.error(t("Không lưu được profile vào IndexedDB"));
          }
        }}
      />
    </>
  );
}
