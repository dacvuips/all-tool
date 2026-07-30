import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCog, HiDownload, HiOutlineX, HiPlay, HiUpload } from "react-icons/hi";
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
import { useConcurrencyLimits } from "../../app/affiliate-video/hook/useConcurrencyLimits";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Switch } from "../../shared/utilities/form";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import { loadGenerateVideoConfig, saveGenerateVideoConfig } from "../storage";
import {
  CharacterProfile,
  DEFAULT_GENERATE_VIDEO_CONFIG,
  GenerateVideoConfig,
  GenerateVideoPromptConfig,
  GenerateVideoSlotConfig,
  ManagedOption,
  PromptTemplateField,
  buildActivePromptFromConfig,
  buildActivePromptFromSlot,
  buildCheckTotalPrompt,
  buildDialoguePrompt,
  createSlotConfigFromRoot,
  ensureVideoSlots,
  getDefaultPrompt,
  isSlotPromptConfigured,
  listCharacterImages,
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
  { key: "checkTotal", label: "Check Prompt Tổng", style: { background: "#059669" } },
  { key: "dialogue", label: "Prompt Tạo Thoại", style: { background: "#D97706" } },
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
      className="inline-flex gap-1 items-center px-2 py-1 font-semibold text-gray-600 bg-white rounded-md border border-gray-200 text-10 hover:bg-gray-50"
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

const fieldClass =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-800 outline-none focus:border-primary";

function getSelectedCharacter(
  config: GenerateVideoConfig,
  characterId?: string
): CharacterProfile | null {
  const id = characterId || config.characterId;
  return config.characters.find((item) => item.id === id) || config.characters[0] || null;
}

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
    <div className="flex gap-1.5 items-center min-w-0">
      <span className="shrink-0 text-xs font-medium text-gray-500 whitespace-nowrap">{label}</span>
      <div className="flex flex-1 gap-1.5 items-center min-w-0">{children}</div>
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${fieldClass} ${className}${disabled ? " opacity-50 cursor-not-allowed" : ""}`}
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
  const { VIDEO_CONCURRENCY } = useConcurrencyLimits();

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
  const [manageList, setManageList] = useState<"techniques" | "actionsV1" | "actionsV2" | null>(
    null
  );
  const [manageDraft, setManageDraft] = useState("");
  const [characterManagerOpen, setCharacterManagerOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const loaded = await loadGenerateVideoConfig();
      if (cancelled) return;
      setConfig(loaded);
      setActiveSlotIndex(0);
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
      setCharacterManagerOpen(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const slotCount = Math.min(4, Math.max(1, config.videosPerJob || 1));
  const videoSlots = ensureVideoSlots(config);
  const safeSlotIndex = Math.min(activeSlotIndex, Math.max(0, slotCount - 1));
  const activeSlot: GenerateVideoSlotConfig = config.splitPrompt
    ? videoSlots[safeSlotIndex] || createSlotConfigFromRoot(config)
    : createSlotConfigFromRoot(config);

  /** Prompt/video đang chỉnh — root hoặc slot đang chọn khi tách prompt. */
  const workingPrompts: GenerateVideoPromptConfig = activeSlot.prompts;
  const workingCharacterId = activeSlot.characterId;

  const patch = (partial: Partial<GenerateVideoConfig>) => {
    setConfig((c) => ({ ...c, ...partial }));
  };

  const patchSlot = (partial: Partial<GenerateVideoSlotConfig>) => {
    setConfig((c) => {
      if (!c.splitPrompt) {
        const next = { ...c, ...partial } as GenerateVideoConfig;
        if (partial.prompts) next.prompts = { ...c.prompts, ...partial.prompts };
        return next;
      }
      const slots = ensureVideoSlots(c);
      const idx = Math.min(activeSlotIndex, Math.max(0, slots.length - 1));
      const updated: GenerateVideoSlotConfig = {
        ...slots[idx],
        ...partial,
        prompts: partial.prompts
          ? { ...slots[idx].prompts, ...partial.prompts }
          : slots[idx].prompts,
      };
      slots[idx] = updated;
      // Đồng bộ root với slot 0 để tương thích luồng cũ
      const rootSync =
        idx === 0
          ? {
              prompts: updated.prompts,
              activePrompt: updated.activePrompt,
              workflow: updated.workflow,
              voice: updated.voice,
              techniqueId: updated.techniqueId,
              characterId: updated.characterId,
              useCharacterImage: updated.useCharacterImage,
              randomImagesEnabled: updated.randomImagesEnabled,
              randomImagesPrompt: updated.randomImagesPrompt,
              actionV1Id: updated.actionV1Id,
              actionV2Id: updated.actionV2Id,
              imageModel: updated.imageModel,
              videoModel: updated.videoModel,
              quality: updated.quality,
            }
          : {};
      return { ...c, ...rootSync, videoSlots: slots };
    });
  };

  const setVideosPerJob = (n: number) => {
    const videosPerJob = Math.min(4, Math.max(1, n));
    setConfig((c) => {
      const next = { ...c, videosPerJob };
      next.videoSlots = ensureVideoSlots(next);
      return next;
    });
    setActiveSlotIndex((i) => Math.min(i, videosPerJob - 1));
  };

  const setSplitPrompt = (enabled: boolean) => {
    setConfig((c) => {
      const next = { ...c, splitPrompt: enabled };
      if (enabled) {
        // Tab 1 = config hiện tại; các tab còn lại prompt trống → fallback tab 1 khi generate
        const slot0 = createSlotConfigFromRoot(c);
        next.videoSlots = ensureVideoSlots({
          ...next,
          videoSlots: [slot0],
        });
      }
      return next;
    });
    setActiveSlotIndex(0);
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
    const prompts = workingPrompts;
    const character = getSelectedCharacter(config, workingCharacterId);
    if (key === "rulesNegative") {
      setDirectivesDraft(prompts.directives || "");
      setNegativeDraft(prompts.rulesNegative || "");
      setPromptDraft("");
    } else if (key === "dialogue") {
      setDialogueSystemDraft(prompts.dialogueSystem || "");
      setDialogueSection1Draft(prompts.dialogueSection1 || "");
      setDialogueSectionLastDraft(prompts.dialogueSectionLast || "");
      setPromptDraft("");
    } else if (key === "checkTotal") {
      setPromptDraft(
        buildCheckTotalPrompt(prompts, character, {
          enabled: activeSlot.randomImagesEnabled,
          prompt: activeSlot.randomImagesPrompt,
        })
      );
    } else {
      setPromptDraft(prompts[key] || "");
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

    const character = getSelectedCharacter(config, workingCharacterId);
    const randomOverride = {
      enabled: activeSlot.randomImagesEnabled,
      prompt: activeSlot.randomImagesPrompt,
    };
    let nextPrompts = { ...workingPrompts };

    if (editingPrompt === "rulesNegative") {
      nextPrompts = {
        ...nextPrompts,
        directives: directivesDraft,
        rulesNegative: negativeDraft,
        checkTotal: buildCheckTotalPrompt(
          {
            ...nextPrompts,
            directives: directivesDraft,
            rulesNegative: negativeDraft,
          },
          character,
          randomOverride
        ),
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
        checkTotal: buildCheckTotalPrompt(
          {
            ...nextPrompts,
            dialogueSystem: dialogueSystemDraft,
            dialogueSection1: dialogueSection1Draft,
            dialogueSectionLast: dialogueSectionLastDraft,
            dialogue,
          },
          character,
          randomOverride
        ),
      };
    } else {
      nextPrompts = {
        ...nextPrompts,
        [editingPrompt]: promptDraft,
        checkTotal: buildCheckTotalPrompt(
          {
            ...nextPrompts,
            [editingPrompt]: promptDraft,
          },
          character,
          randomOverride
        ),
      };
    }

    patchSlot({ prompts: nextPrompts });
    closePromptEditor();
    // Persist after state update — build next from current + patch
    try {
      const base = config.splitPrompt
        ? (() => {
            const slots = ensureVideoSlots(config);
            const idx = safeSlotIndex;
            slots[idx] = { ...slots[idx], prompts: nextPrompts };
            const rootSync = idx === 0 ? { prompts: nextPrompts } : {};
            return { ...config, ...rootSync, videoSlots: slots };
          })()
        : { ...config, prompts: nextPrompts };
      const saved = await saveGenerateVideoConfig(base);
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

  const handlePlayVoice = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(`Xin chào, đây là giọng ${activeSlot.voice}`);
      u.lang = "vi-VN";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } else {
      toast.info(t("Trình duyệt không hỗ trợ phát thử giọng"));
    }
  };

  const handleQuickTest = () => {
    if (config.splitPrompt) {
      const slots = ensureVideoSlots(config);
      const lens = slots.map((s) => buildActivePromptFromSlot(s, config.characters).length);
      toast.success(
        t("Test nhanh OK — {{count}} prompt: {{lens}}", {
          count: slots.length,
          lens: lens.join(", "),
        })
      );
      return;
    }
    const prompt = buildActivePromptFromConfig(config);
    toast.success(t("Test nhanh OK — prompt {{len}} ký tự", { len: prompt.length }));
  };

  const handleCleanup = async () => {
    if (!confirm(t("Reset cấu hình generate video về mặc định?"))) return;
    try {
      const next = await saveGenerateVideoConfig({ ...DEFAULT_GENERATE_VIDEO_CONFIG });
      setConfig(next);
      setActiveSlotIndex(0);
      toast.success(t("Đã dọn dẹp cấu hình"));
    } catch (err) {
      console.error(err);
      toast.error(t("Không lưu được cấu hình vào IndexedDB"));
    }
  };

  const handleSave = async () => {
    let next: GenerateVideoConfig = { ...config };
    if (config.splitPrompt) {
      const slots = ensureVideoSlots(config).map((slot) => {
        const character = getSelectedCharacter(config, slot.characterId);
        const checkTotal = buildCheckTotalPrompt(slot.prompts, character, {
          enabled: slot.randomImagesEnabled,
          prompt: slot.randomImagesPrompt,
        });
        const activePrompt = buildActivePromptFromSlot(
          { ...slot, prompts: { ...slot.prompts, checkTotal } },
          config.characters
        );
        return {
          ...slot,
          prompts: { ...slot.prompts, checkTotal },
          activePrompt,
        };
      });
      const root = slots[0] || createSlotConfigFromRoot(config);
      next = {
        ...config,
        splitPrompt: true,
        videoSlots: slots,
        prompts: root.prompts,
        activePrompt: root.activePrompt,
        workflow: root.workflow,
        voice: root.voice,
        techniqueId: root.techniqueId,
        characterId: root.characterId,
        useCharacterImage: root.useCharacterImage,
        randomImagesEnabled: root.randomImagesEnabled,
        randomImagesPrompt: root.randomImagesPrompt,
        actionV1Id: root.actionV1Id,
        actionV2Id: root.actionV2Id,
        imageModel: root.imageModel,
        videoModel: root.videoModel,
        quality: root.quality,
      };
    } else {
      const checkTotal = buildCheckTotalPrompt(config.prompts, getSelectedCharacter(config), {
        enabled: config.randomImagesEnabled,
        prompt: config.randomImagesPrompt,
      });
      const activePrompt = buildActivePromptFromConfig(config);
      next = {
        ...config,
        splitPrompt: false,
        prompts: { ...config.prompts, checkTotal },
        activePrompt,
        videoSlots: ensureVideoSlots(config),
      };
    }
    try {
      const saved = await saveGenerateVideoConfig(next);
      setConfig(saved);
      onSaveAndApply(saved, buildActivePromptFromConfig(saved));
      toast.success(t("Đã lưu setting và áp dụng prompt cho tất cả luồng"));
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t("Không lưu được cấu hình"));
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
    checkTotal: "Check Prompt Tổng",
    dialogue: "Prompt Tạo Thoại",
    image: "Prompt Tạo Ảnh",
  };

  const manageTitles = {
    techniques: "Kỹ Thuật",
    actionsV1: "Action V1",
    actionsV2: "Action V2",
  };

  const filledPromptCount = PROMPT_BUTTONS.filter((btn) => {
    if (btn.key === "rulesNegative") {
      return !!(workingPrompts.directives?.trim() || workingPrompts.rulesNegative?.trim());
    }
    if (btn.key === "dialogue") {
      return !!(
        workingPrompts.dialogueSystem?.trim() ||
        workingPrompts.dialogueSection1?.trim() ||
        workingPrompts.dialogueSectionLast?.trim() ||
        workingPrompts.dialogue?.trim()
      );
    }
    if (btn.key === "checkTotal") {
      return !!buildCheckTotalPrompt(
        workingPrompts,
        getSelectedCharacter(config, workingCharacterId),
        {
          enabled: activeSlot.randomImagesEnabled,
          prompt: activeSlot.randomImagesPrompt,
        }
      ).trim();
    }
    return !!workingPrompts[btn.key]?.trim();
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
        wrapperClass="fixed w-full h-screen top-0 left-0 z-100 flex items-start justify-center overflow-y-auto px-4 pt-16 pb-8 sm:items-center sm:py-12"
        dialogClass="relative bg-white shadow-md rounded-2xl m-auto overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] sm:max-h-[90vh]"
        headerClass="relative flex items-center px-5 py-4 bg-white border-b border-gray-100 rounded-t-2xl z-10 shrink-0"
        bodyClass="relative p-0 bg-gray-50 overflow-y-auto flex-1 min-h-0"
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
              <div className="text-sm font-bold tracking-tight text-gray-900">{t("Cấu hình")}</div>
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
          <div className="overflow-y-auto p-4 space-y-4">
            {/* General */}
            <SectionCard title={t("Cấu Hình Tổng Thể")} accent="#0D9488" icon={<RiSettings4Line />}>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FieldRow label={t("Số video mỗi job")}>
                  <NativeSelect
                    value={String(slotCount)}
                    onChange={(v) => setVideosPerJob(Number(v) || 1)}
                    options={[1, 2, 3, 4].map((n) => ({
                      value: String(n),
                      label: String(n),
                    }))}
                  />
                </FieldRow>
                <FieldRow label={t("Số luồng video chạy song song")}>
                  <div className="flex flex-1 gap-2 items-center min-w-0">
                    <input
                      className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`}
                      value={Math.max(1, Math.round(VIDEO_CONCURRENCY || 1))}
                      disabled
                      readOnly
                      title={
                        t(
                          "Theo số luồng video của customer (googlePackage.videoStreamCount) — không chỉnh được"
                        ) as string
                      }
                    />
                    <span className="text-10 text-gray-400 whitespace-nowrap shrink-0">
                      {t("Theo gói KH")}
                    </span>
                  </div>
                </FieldRow>
              </div>
              <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-teal-900">{t("Tách Prompt")}</div>
                  <div className="mt-0.5 text-10 leading-relaxed text-teal-800">
                    {t(
                      'Nếu kích hoạt thì sẽ tách ra từng job riêng theo "Số video mỗi job" mỗi job là 1 lần Generate và 1 prompt khác nhau'
                    )}
                  </div>
                </div>
                <Switch
                  size="sm"
                  dependent
                  value={Boolean(config.splitPrompt)}
                  onChange={(value) => setSplitPrompt(Boolean(value))}
                />
              </div>
            </SectionCard>

            {config.splitPrompt ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: slotCount }, (_, i) => {
                    const configured =
                      i === 0 ||
                      isSlotPromptConfigured(videoSlots[i] || createSlotConfigFromRoot(config));
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveSlotIndex(i)}
                        className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                          safeSlotIndex === i
                            ? "bg-primary text-white shadow-sm hover:bg-primary-dark"
                            : "bg-white text-gray-600 border border-gray-200 hover:border-primary hover:text-primary-dark"
                        }`}
                      >
                        {t("Video - {{n}}", { n: i + 1 })}
                        {i > 0 ? (
                          <span
                            className={`ml-1.5 text-10 font-semibold ${
                              safeSlotIndex === i
                                ? configured
                                  ? "text-white/90"
                                  : "text-white/70"
                                : configured
                                ? "text-emerald-600"
                                : "text-gray-400"
                            }`}
                          >
                            {configured ? t("riêng") : t("tab 1")}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {safeSlotIndex > 0 && !isSlotPromptConfigured(activeSlot) ? (
                  <p className="m-0 text-10 leading-relaxed text-teal-800">
                    {t(
                      "Tab này chưa lưu prompt riêng — khi generate sẽ dùng prompt của Video - 1. Chỉnh prompt rồi Lưu Setting để tách riêng."
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-4">
              {/* Prompt */}
              <SectionCard title={t("Cấu Hình Prompt")} accent="#7C3AED" icon={<HiCog />}>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PROMPT_BUTTONS.map((btn) => {
                      const filled =
                        btn.key === "rulesNegative"
                          ? !!(
                              workingPrompts.directives?.trim() ||
                              workingPrompts.rulesNegative?.trim()
                            )
                          : btn.key === "dialogue"
                          ? !!(
                              workingPrompts.dialogueSystem?.trim() ||
                              workingPrompts.dialogueSection1?.trim() ||
                              workingPrompts.dialogueSectionLast?.trim() ||
                              workingPrompts.dialogue?.trim()
                            )
                          : btn.key === "checkTotal"
                          ? !!buildCheckTotalPrompt(
                              workingPrompts,
                              getSelectedCharacter(config, workingCharacterId),
                              {
                                enabled: activeSlot.randomImagesEnabled,
                                prompt: activeSlot.randomImagesPrompt,
                              }
                            ).trim()
                          : !!workingPrompts[btn.key]?.trim();
                      return (
                        <button
                          key={btn.key}
                          type="button"
                          onClick={() => openPromptEditor(btn.key)}
                          style={btn.style}
                          className="relative w-full rounded-lg px-2 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 text-center sm:px-3"
                        >
                          {t(btn.label)}
                          {filled && (
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-white border-2 border-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImportText("");
                        setImportOpen(true);
                      }}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90"
                      style={{ background: "#7C3AED" }}
                    >
                      <HiDownload className="text-sm" />
                      {t("Import Template")}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportTemplate}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90"
                      style={{ background: "#4F46E5" }}
                    >
                      <HiUpload className="text-sm" />
                      {t("Export Template")}
                    </button>
                  </div>
                </div>
              </SectionCard>

              {/* Video */}
              <SectionCard title={t("Cấu Hình Video")} accent="#F2890D" icon={<RiVideoAddLine />}>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-x-4">
                  <FieldRow label="WorkFlow">
                    <NativeSelect
                      value={activeSlot.workflow}
                      onChange={(v) => patchSlot({ workflow: v })}
                      options={WORKFLOW_OPTIONS}
                    />
                  </FieldRow>

                  <FieldRow label="Voice">
                    <NativeSelect
                      value={activeSlot.voice}
                      onChange={(v) => patchSlot({ voice: v })}
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
                      value={activeSlot.techniqueId}
                      onChange={(v) => patchSlot({ techniqueId: v })}
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
                      className="px-3 h-9 text-xs font-semibold rounded-lg border border-opacity-30 shrink-0 border-primary whitespace-nowrap bg-primary-light text-primary-dark hover:bg-primary hover:bg-opacity-10"
                    >
                      {t("Quản lý")}
                    </button>
                  </FieldRow>

                  <FieldRow label={t("Nhân Vật")}>
                    <NativeSelect
                      value={activeSlot.characterId}
                      onChange={(v) => patchSlot({ characterId: v })}
                      options={config.characters.map((o) => ({
                        value: o.id,
                        label: o.name,
                      }))}
                      disabled={activeSlot.useCharacterImage === false}
                    />
                    <button
                      type="button"
                      onClick={() => setCharacterManagerOpen(true)}
                      className="px-3 h-9 text-xs font-semibold rounded-lg border border-opacity-30 shrink-0 border-primary whitespace-nowrap bg-primary-light text-primary-dark hover:bg-primary hover:bg-opacity-10"
                    >
                      {t("Quản lý")}
                    </button>
                  </FieldRow>
                  </div>

                  <div className="flex items-start justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-indigo-800">
                        {t("Dùng ảnh nhân vật")}
                      </div>
                      <div className="mt-0.5 text-10 text-indigo-700">
                        {t(
                          "Bật: gửi ảnh nhân vật + ảnh sản phẩm. Tắt: chỉ gửi ảnh sản phẩm khi generate."
                        )}
                      </div>
                    </div>
                    <Switch
                      size="sm"
                      dependent
                      value={activeSlot.useCharacterImage !== false}
                      onChange={(value) => patchSlot({ useCharacterImage: Boolean(value) })}
                    />
                  </div>

                  {activeSlot.useCharacterImage !== false ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-amber-800">
                            {t("Ảnh ngẫu nhiên")}
                          </div>
                          <div className="mt-0.5 text-10 text-amber-700">
                            {t(
                              "Bật để gửi toàn bộ ảnh model vào generate và cộng prompt riêng vào Check Prompt Tổng."
                            )}
                          </div>
                        </div>
                        <Switch
                          size="sm"
                          dependent
                          value={activeSlot.randomImagesEnabled === true}
                          onChange={(value) => patchSlot({ randomImagesEnabled: Boolean(value) })}
                        />
                      </div>
                      {activeSlot.randomImagesEnabled ? (
                        <div className="mt-3 space-y-2">
                          <label className="mb-1 block text-xs font-semibold text-gray-700">
                            {t("Prompt Ảnh Ngẫu Nhiên")}
                          </label>
                          <textarea
                            value={activeSlot.randomImagesPrompt || ""}
                            onChange={(e) => patchSlot({ randomImagesPrompt: e.target.value })}
                            rows={3}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none focus:border-amber-400"
                            placeholder={t(
                              "Prompt này chỉ được gắn vào Check Prompt Tổng khi bật Ảnh ngẫu nhiên."
                            )}
                          />
                          {(() => {
                            const character = getSelectedCharacter(config, activeSlot.characterId);
                            const imgCount = character ? listCharacterImages(character).length : 0;
                            if (imgCount <= 1) {
                              return (
                                <p className="m-0 text-10 leading-relaxed text-rose-600">
                                  {t(
                                    "Nhân vật này mới có {{count}} ảnh (standing/sitting/fashion). Ảnh ngẫu nhiên cần ≥2 ảnh trong Quản lý Nhân Vật — nếu chỉ 1 file thì cột ngoài cũng chỉ hiện 1 ảnh.",
                                    { count: imgCount }
                                  )}
                                </p>
                              );
                            }
                            return (
                              <p className="m-0 text-10 leading-relaxed text-amber-800">
                                {t(
                                  "Sẽ gửi {{count}} ảnh model khi generate tab này. V1–V4 cùng nhân vật sẽ hiện cùng bộ ảnh.",
                                  { count: imgCount }
                                )}
                              </p>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-x-4">
                  {(
                    [
                      {
                        label: "Action V1",
                        list: "actionsV1" as const,
                        id: activeSlot.actionV1Id,
                        setId: (v: string) => patchSlot({ actionV1Id: v }),
                      },
                      {
                        label: "Action V2",
                        list: "actionsV2" as const,
                        id: activeSlot.actionV2Id,
                        setId: (v: string) => patchSlot({ actionV2Id: v }),
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
                        className="px-3 h-9 text-xs font-semibold rounded-lg border border-opacity-30 shrink-0 border-primary whitespace-nowrap bg-primary-light text-primary-dark hover:bg-primary hover:bg-opacity-10"
                      >
                        {t("Quản lý")}
                      </button>
                    </FieldRow>
                  ))}
                  </div>
                </div>

                {manageList && (
                  <div className="p-3 mt-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-orange-700 whitespace-nowrap">
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
            </div>
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
        maxWidth="96vw"
        slideFromBottom="none"
        wrapperClass="fixed w-full h-screen top-0 left-0 z-100 flex items-center justify-center overflow-y-auto p-4"
        dialogClass="relative bg-white shadow-md rounded-2xl m-auto overflow-hidden flex flex-col max-h-[90vh]"
        bodyClass="relative px-5 pb-4 pt-1 bg-white flex-1 min-h-0 overflow-y-auto"
      >
        <Dialog.Body>
          <div className="min-h-0">
            {editingPrompt === "rulesNegative" ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t("Directives")}{" "}
                      <span className="font-normal text-gray-400">
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
                    className="px-3 py-2 w-full text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-primary"
                    placeholder={t("Mỗi dòng một chỉ thị nên làm...")}
                    autoFocus
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t("Negative Prompt")}{" "}
                      <span className="font-normal text-gray-400">
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
                    className="px-3 py-2 w-full text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-primary"
                    placeholder={t("Mỗi dòng một chỉ thị không nên làm...")}
                  />
                </div>
                <p className="m-0 text-gray-500 text-10">
                  {t("Nội dung sẽ được tổng hợp vào Check Prompt Tổng (chỉ xem).")}
                </p>
              </div>
            ) : editingPrompt === "dialogue" ? (
              <div className="space-y-4 pr-1">
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t("System Instruction")}{" "}
                      <span className="font-normal text-gray-400">({t("Vai trò & Luật lệ")})</span>
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
                    className="px-3 py-2 w-full text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-primary"
                    placeholder={t("Nhập system instruction...")}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t("User Prompt")}{" "}
                    <span className="font-normal text-gray-400">
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
                        className="px-3 py-2 w-full text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-primary"
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
                        className="px-3 py-2 w-full text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-primary"
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
                <pre className="m-0 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800">
                  {promptDraft.trim() || t("Chưa có prompt nào được cấu hình.")}
                </pre>
              </div>
            ) : (
              <>
                <div className="mb-1.5 flex justify-end">
                  <PromptFieldResetButton field="image" onReset={(v) => setPromptDraft(v)} />
                </div>
                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={8}
                  className="px-3 py-2 w-full text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-primary"
                  placeholder={t("Nhập prompt...")}
                  autoFocus
                />
                <p className="m-0 mt-2 text-gray-500 text-10">
                  {t("Sẽ được gộp vào Check Prompt Tổng khi Lưu.")}
                </p>
              </>
            )}
          </div>
          <div className="flex sticky bottom-0 gap-2 justify-end pt-4 mt-4 bg-white border-t border-gray-100">
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
        maxWidth="96vw"
        slideFromBottom="none"
        wrapperClass="fixed w-full h-screen top-0 left-0 z-100 flex items-center justify-center overflow-y-auto p-4"
        dialogClass="relative bg-white shadow-md rounded-2xl m-auto overflow-hidden flex flex-col max-h-[90vh]"
        bodyClass="relative px-5 pb-4 bg-white flex-1 min-h-0 overflow-y-auto"
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
