import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDotsVertical,
  HiDownload,
  HiOutlinePhotograph,
  HiShare,
  HiSparkles,
  HiThumbDown,
  HiThumbUp,
  HiVideoCamera,
} from "react-icons/hi";
import { useAuth } from "../../lib/providers/auth-provider";
import { useSettingPublic } from "../../lib/hooks/useSettingPublic";
import { useToast } from "../../lib/providers/toast-provider";
import { Button } from "../shared/utilities/form";
import { getFilmEntityImageSrc } from "./api/generate-film-media";
import FilmCharacterVoiceDialog, {
  dialogueLineToAttachedVoice,
  filmCharacterToAttachedVoice,
  type FilmCharacterVoicePick,
} from "./film-character-voice-dialog";
import FilmCharacterVoiceIcon, {
  clearFilmCharacterVoice,
  filmCharacterHasVoice,
  FilmCharacterVoiceCreateButton,
  FilmCharacterVoiceResetButton,
  FilmCharacterVoiceUnlinkButton,
} from "./film-character-voice-icon";
import {
  buildFilmVoiceCharacterRoster,
  buildFilmVoiceListItems,
  characterHasCustomDialogueVoices,
  dialogueLineCreating,
  dialogueLineReady,
  hydrateScenesDialogueLines,
  patchSceneDialogueLine,
  resetCharacterDialogueLineVoices,
  resolveCharacterVoiceLink,
  resolveDialogueLineVoiceLink,
  type FilmVoiceListItem,
} from "./film-dialogue";
import { getFilmScenesByProject } from "./film-idb";
import type { FilmStoryboardTab } from "./film-storyboard-panel";
import { FilmCharacterRecord, FilmEpisodeRecord, FilmSceneRecord } from "./film-types";
import FilmVoiceCard from "./film-voice-card";
import FilmVoiceConfigDialog from "./film-voice-config-dialog";
import { downloadFilmVoicesZip } from "./film-voice-download";
import { filmDialogueVoiceBlockReason } from "./film-access";
import type { FilmVoiceGenerateInput } from "./film-voice-generate";
import { FilmProductionSearchInput } from "./film-production-search-input";
import { matchesFilmNameSearch } from "./film-production-search";

type Props = {
  projectId?: string;
  scenes: FilmSceneRecord[];
  characters?: FilmCharacterRecord[];
  episodes?: FilmEpisodeRecord[];
  promptTemplate?: string | null;
  onSaveCharacter?: (c: FilmCharacterRecord) => Promise<void>;
  onCharactersChange?: (next: FilmCharacterRecord[]) => void;
  onCreateVoice: (input: FilmVoiceGenerateInput) => Promise<void>;
  onSetDefaultVoiceTake?: (item: FilmVoiceListItem, takeId: string) => Promise<void> | void;
  onStopVoice?: (item: FilmVoiceListItem) => Promise<void> | void;
  onBulkCreateVoices?: (items: FilmVoiceListItem[]) => Promise<void>;
  onStopBulkVoices?: () => Promise<void> | void;
  /** Scene đang tạo hàng loạt (mọi tập) — cập nhật list theo bộ lọc nhân vật/tập */
  overlayScenes?: FilmSceneRecord[] | null;
  onSaveScene?: (scene: FilmSceneRecord) => Promise<void>;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Chuỗi phân cảnh" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmVoicePanel({
  projectId,
  scenes,
  characters = [],
  episodes = [],
  promptTemplate: _promptTemplate,
  onSaveCharacter,
  onCharactersChange,
  onCreateVoice,
  onSetDefaultVoiceTake,
  onStopVoice,
  onBulkCreateVoices,
  onStopBulkVoices,
  overlayScenes,
  onSaveScene,
  onTabNavigate,
}: Props) {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const toast = useToast();
  const blockSetting = useSettingPublic("pa-b-page");
  const marketplaceStopped = Boolean(blockSetting?.key);
  const [tab, setTab] = useState<FilmStoryboardTab>("voice");
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [voiceEditCharacter, setVoiceEditCharacter] = useState<FilmCharacterRecord | null>(null);
  const [voiceEditLine, setVoiceEditLine] = useState<FilmVoiceListItem | null>(null);
  const [voiceConfigOpen, setVoiceConfigOpen] = useState(false);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const [episodeFilter, setEpisodeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allScenes, setAllScenes] = useState<FilmSceneRecord[]>(scenes);
  const [sceneRefresh, setSceneRefresh] = useState(0);

  useEffect(() => {
    if (!projectId) {
      setAllScenes(scenes);
      return;
    }
    let cancelled = false;
    void getFilmScenesByProject(projectId).then((rows) => {
      if (cancelled) return;
      setAllScenes(hydrateScenesDialogueLines(rows).scenes);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, sceneRefresh]);

  useEffect(() => {
    if (!projectId) return;
    setAllScenes((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      for (const s of scenes) map.set(s.id, s);
      return map.size ? Array.from(map.values()) : prev;
    });
  }, [scenes, projectId]);

  useEffect(() => {
    if (!overlayScenes?.length) return;
    setAllScenes((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      for (const s of overlayScenes) map.set(s.id, s);
      return Array.from(map.values());
    });
  }, [overlayScenes]);

  const episodeOrder = useMemo(
    () => new Map(episodes.map((ep) => [ep.id, ep.index])),
    [episodes]
  );
  const episodeLabelById = useMemo(
    () =>
      new Map(
        episodes.map((ep) => [
          ep.id,
          ep.title?.trim() || `${t("Tập")} ${ep.index}`,
        ])
      ),
    [episodes, t]
  );

  const list = useMemo(
    () => buildFilmVoiceListItems(allScenes, episodeOrder),
    [allScenes, episodeOrder]
  );
  const speakers = useMemo(
    () => buildFilmVoiceCharacterRoster(characters, list),
    [list, characters]
  );
  const visibleList = useMemo(() => {
    let next = list;
    if (episodeFilter) {
      next = next.filter((x) => x.scene.episodeId === episodeFilter);
    }
    if (speakerFilter) {
      next = next.filter(
        (x) => x.line.character?.trim().toLowerCase() === speakerFilter
      );
    }
    if (searchQuery.trim()) {
      next = next.filter((x) =>
        matchesFilmNameSearch([x.line.character], searchQuery)
      );
    }
    return next;
  }, [list, episodeFilter, speakerFilter, searchQuery]);
  const readyCount = visibleList.filter((x) => dialogueLineReady(x.line)).length;
  const anyCreating = visibleList.some((x) => dialogueLineCreating(x.line));
  const bulkEligibleCount = useMemo(
    () =>
      visibleList.filter((item) => {
        if (dialogueLineReady(item.line) || dialogueLineCreating(item.line)) return false;
        if (!item.line.line?.trim()) return false;
        const linked = resolveDialogueLineVoiceLink(item.line, characters);
        return !!linked.voiceId?.trim();
      }).length,
    [visibleList, characters]
  );
  const credits = useMemo(() => {
    const count = customer?.googlePackage?.textCreditCount ?? 0;
    const limit = customer?.googlePackage?.textCreditLimit ?? 0;
    if (limit === -1) return `${count} / ∞`;
    return `${count} / ${limit}`;
  }, [customer?.googlePackage?.textCreditCount, customer?.googlePackage?.textCreditLimit]);
  const speakerHasVoice = useCallback(
    (sp: (typeof speakers)[number]) => {
      if (sp.character?.voiceId?.trim() || sp.character?.voiceLabel?.trim()) return true;
      const name = sp.name.trim().toLowerCase();
      return list.some((item) => {
        if (item.line.character?.trim().toLowerCase() !== name) return false;
        const linked = resolveDialogueLineVoiceLink(item.line, characters);
        return !!(linked.voiceId || linked.voiceLabel);
      });
    },
    [list, characters]
  );
  const voiceConfigured =
    speakers.length > 0 && speakers.every((sp) => speakerHasVoice(sp));

  const openVoiceConfig = () => {
    setVoiceConfigOpen(true);
  };

  const closeVoiceDialog = () => {
    setVoiceEditCharacter(null);
    setVoiceEditLine(null);
  };

  const resetSpeakerLineVoices = async (speakerName: string) => {
    if (!onSaveScene) return;
    const { scenes: next, changed } = resetCharacterDialogueLineVoices(
      allScenes,
      speakerName
    );
    if (!changed.length) return;
    setAllScenes(next);
    for (const scene of changed) {
      await onSaveScene(scene);
    }
    toast.success(t("Đã reset giọng các câu thoại về giọng nhân vật"));
  };

  const handleTab = (id: FilmStoryboardTab) => {
    setTab(id);
    if (id !== "voice") onTabNavigate?.(id);
  };

  const removeCharacterVoice = async (character: FilmCharacterRecord) => {
    const draft = clearFilmCharacterVoice(character);
    onCharactersChange?.(
      characters.map((x) => (x.id === draft.id ? draft : x))
    );
    await onSaveCharacter?.(draft);
  };

  const createVoiceForItem = async (item: FilmVoiceListItem) => {
    if (busy || dialogueLineCreating(item.line)) return;
    const linked = resolveDialogueLineVoiceLink(item.line, characters);
    if (!linked.voiceId?.trim()) return;
    const text = item.line.line?.trim();
    if (!text) return;
    const blocked = filmDialogueVoiceBlockReason(
      customer,
      marketplaceStopped,
      linked.voiceId
    );
    if (blocked) {
      toast.warn(t(blocked));
      return;
    }
    const scene = allScenes.find((s) => s.id === item.scene.id) || item.scene;
    setBusy(true);
    try {
      await onCreateVoice({
        scene,
        dialogueLineId: item.line.id,
        text,
        voiceId: linked.voiceId,
        voiceLabel: linked.voiceLabel || linked.voiceId,
      });
      setSceneRefresh((v) => v + 1);
    } finally {
      setBusy(false);
    }
  };

  const handleBulk = async () => {
    if (busy || !onBulkCreateVoices || !bulkEligibleCount) return;
    const targets = visibleList.filter((item) => {
      if (dialogueLineReady(item.line) || dialogueLineCreating(item.line)) return false;
      if (!item.line.line?.trim()) return false;
      const linked = resolveDialogueLineVoiceLink(item.line, characters);
      return !!linked.voiceId?.trim();
    });
    if (!targets.length) return;
    for (const item of targets) {
      const linked = resolveDialogueLineVoiceLink(item.line, characters);
      const blocked = filmDialogueVoiceBlockReason(
        customer,
        marketplaceStopped,
        linked.voiceId || ""
      );
      if (blocked) {
        toast.warn(t(blocked));
        return;
      }
    }
    setBusy(true);
    try {
      await onBulkCreateVoices(targets);
      setSceneRefresh((v) => v + 1);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadZip = async () => {
    if (zipping || !readyCount) return;
    setZipping(true);
    try {
      const count = await downloadFilmVoicesZip(visibleList, episodeLabelById);
      if (!count) {
        toast.warn(t("Chưa có file âm thanh để tải."));
        return;
      }
    } catch (err: any) {
      toast.error(err?.message || t("Tải zip thất bại"));
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 relative">
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-0 cursor-pointer transition-colors ${
                active
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {active && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
              {item.id === "storyboard" && !active && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
              {t(item.label)}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-1 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl  flex items-center justify-center flex-shrink-0">
              <HiVideoCamera className="text-lg text-gray-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 m-0">{t("Bảng sản xuất")}</h2>
              <p className="text-xs text-gray-400 m-0 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>
                  {visibleList.length}
                  {visibleList.length !== list.length ? `/${list.length}` : ""}{" "}
                  {t("câu thoại")}
                </span>
                <span>·</span>
                <span>
                  {readyCount}/{visibleList.length || 0} {t("đã tạo")}
                </span>
                <span>·</span>
                <span>{t("Voice Credit")}: {credits}</span>
                {voiceConfigured ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-green-50 text-green-600 border border-green-100">
                    {t("Đã cấu hình")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={openVoiceConfig}
                    disabled={!characters.length}
                    title={t("Cấu hình Giọng")}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("Cấu hình")}
                  </button>
                )}
              </p>
            </div>
          </div>
          <FilmProductionSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("Tìm nhân vật...")}
            className="w-full sm:flex-1 sm:max-w-xs order-last sm:order-none"
          />
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {onBulkCreateVoices && (
              anyCreating && onStopBulkVoices ? (
                <Button
                  outline
                  small
                  text={t("Dừng tạo")}
                  className="!rounded-lg"
                  onClick={() => void onStopBulkVoices()}
                />
              ) : (
                <Button
                  outline
                  small
                  text={t("Tạo hàng loạt")}
                  className="!rounded-lg"
                  onClick={handleBulk}
                  isLoading={busy}
                  disabled={!bulkEligibleCount}
                />
              )
            )}
            <Button
              outline
              small
              text={t("Tải xuống âm thanh (.zip)")}
              icon={<HiDownload />}
              className="!rounded-lg"
              onClick={() => void handleDownloadZip()}
              isLoading={zipping}
              disabled={!readyCount || zipping}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 p-4 sm:p-5 overflow-hidden">
          {speakers.length > 0 ? (
            <aside className="flex flex-col min-h-0 w-full md:w-56 lg:w-64 flex-shrink-0 flex-1 md:flex-none md:h-full max-h-[45vh] md:max-h-none">
              <div className="flex-shrink-0 text-10 font-bold tracking-wider text-gray-400 uppercase mb-2">
                {t("Nhân vật")} · {speakers.length}
              </div>
              <ul className="m-0 p-0 list-none flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto v-scrollbar">
                {speakers.map((sp) => {
                  const src = sp.character ? getFilmEntityImageSrc(sp.character) : "";
                  const active =
                    speakerFilter === sp.name.trim().toLowerCase();
                  return (
                    <li key={sp.key}>
                      <button
                        type="button"
                        onClick={() =>
                          setSpeakerFilter((prev) =>
                            prev === sp.name.trim().toLowerCase()
                              ? null
                              : sp.name.trim().toLowerCase()
                          )
                        }
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl border cursor-pointer text-left transition-colors ${
                          active
                            ? "bg-blue-50 border-blue-200"
                            : "bg-white border-gray-100 hover:bg-blue-50 hover:border-blue-200"
                        }`}
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={src}
                              alt={sp.name}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="flex justify-center items-center w-full h-full">
                              <HiOutlinePhotograph className="text-base text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-0.5 min-w-0">
                            <span
                              className={`block truncate text-sm font-bold ${
                                active ? "text-blue-800" : "text-gray-800"
                              }`}
                            >
                              {sp.name}
                            </span>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                            {sp.character ? (
                              <FilmCharacterVoiceCreateButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVoiceEditCharacter(sp.character);
                                }}
                              />
                            ) : null}
                            <FilmCharacterVoiceIcon character={sp.character} />
                            {sp.character && filmCharacterHasVoice(sp.character) ? (
                              <FilmCharacterVoiceUnlinkButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void removeCharacterVoice(sp.character!);
                                }}
                              />
                            ) : null}
                            {characterHasCustomDialogueVoices(sp.name, allScenes) ? (
                              <FilmCharacterVoiceResetButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void resetSpeakerLineVoices(sp.name);
                                }}
                              />
                            ) : null}
                            </div>
                          </div>
                          {sp.lineCount > 0 ? (
                            <span className="block text-10 text-gray-400">
                              {sp.lineCount} {t("câu")}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
          ) : null}

          <div className="flex flex-col flex-1 min-w-0 min-h-0 md:h-full">
            {episodes.length > 0 ? (
              <div className="flex-shrink-0 pb-3">
                <div className="text-10 font-bold tracking-wider text-gray-400 uppercase mb-2">
                  {t("Tập phim")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEpisodeFilter(null)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                      !episodeFilter
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {t("Tất cả")}
                  </button>
                  {episodes.map((ep) => {
                    const on = episodeFilter === ep.id;
                    const label = ep.title || t("Tập {{n}}", { n: ep.index });
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => setEpisodeFilter(on ? null : ep.id)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                          on
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex-1 min-h-0 overflow-y-auto v-scrollbar space-y-3">
            {list.length === 0 ? (
              <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-2">
                <p className="text-sm text-gray-500 m-0 max-w-md">
                  {t(
                    "Chưa có thoại. Thêm field Thoại trong Chuỗi phân cảnh (mỗi dòng: Tên nhân vật: lời thoại) hoặc trích xuất từ nội dung gốc."
                  )}
                </p>
                <Button
                  outline
                  text={t("Mở Chuỗi phân cảnh")}
                  className="!rounded-lg"
                  onClick={() => onTabNavigate?.("storyboard")}
                />
              </div>
            ) : visibleList.length === 0 ? (
              <p className="text-sm text-gray-400 m-0 py-8 text-center">
                {episodeFilter || speakerFilter || searchQuery.trim()
                  ? t("Không có câu thoại khớp bộ lọc.")
                  : t("Không có câu thoại của nhân vật này.")}
              </p>
            ) : (
              visibleList.map((item) => (
                <FilmVoiceCard
                  key={item.key}
                  item={item}
                  characters={characters}
                  episodeLabel={episodeLabelById.get(item.scene.episodeId)}
                  onCreateVoice={createVoiceForItem}
                  onSetDefaultVoiceTake={onSetDefaultVoiceTake}
                  onStopVoice={onStopVoice}
                  onPickLineVoice={(lineItem) => setVoiceEditLine(lineItem)}
                />
              ))
            )}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-end gap-0.5">
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiThumbUp />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiThumbDown />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiAnnotation />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiShare />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiSparkles />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiDotsVertical />
          </button>
        </div>
      </div>

      <FilmVoiceConfigDialog
        isOpen={voiceConfigOpen}
        characters={characters}
        onClose={() => setVoiceConfigOpen(false)}
        onSave={async (draft) => {
          onCharactersChange?.(
            characters.map((x) => (x.id === draft.id ? draft : x))
          );
          await onSaveCharacter?.(draft);
        }}
      />

      <FilmCharacterVoiceDialog
        isOpen={!!voiceEditCharacter || !!voiceEditLine}
        characterName={
          voiceEditCharacter?.name || voiceEditLine?.line.character?.trim() || undefined
        }
        attachedVoice={
          voiceEditCharacter
            ? filmCharacterToAttachedVoice(voiceEditCharacter)
            : voiceEditLine
              ? dialogueLineToAttachedVoice(voiceEditLine.line)
              : null
        }
        onClose={closeVoiceDialog}
        onPick={async (voice: FilmCharacterVoicePick) => {
          if (voiceEditCharacter) {
            const draft: FilmCharacterRecord = {
              ...voiceEditCharacter,
              voiceId: voice.voiceId,
              voiceLabel: voice.voiceLabel,
              voicePreviewBlob: voice.voicePreviewBlob,
              voiceResultId: voice.voiceResultId || undefined,
              updatedAt: new Date().toISOString(),
            };
            onCharactersChange?.(
              characters.map((x) => (x.id === draft.id ? draft : x))
            );
            await onSaveCharacter?.(draft);
            closeVoiceDialog();
            return;
          }
          if (!voiceEditLine || !onSaveScene) return;
          const scene =
            allScenes.find((s) => s.id === voiceEditLine.scene.id) ||
            voiceEditLine.scene;
          const characterVoice = resolveCharacterVoiceLink(
            voiceEditLine.line.character || "",
            characters
          );
          const sameAsCharacter =
            voice.voiceId.trim() === characterVoice.voiceId &&
            (voice.voiceLabel.trim() || voice.voiceId.trim()) ===
              (characterVoice.voiceLabel || characterVoice.voiceId);
          const next = patchSceneDialogueLine(scene, voiceEditLine.line.id, {
            voiceCustom: !sameAsCharacter,
            voiceId: sameAsCharacter ? undefined : voice.voiceId,
            voiceLabel: sameAsCharacter ? undefined : voice.voiceLabel,
          });
          setAllScenes((prev) => prev.map((s) => (s.id === next.id ? next : s)));
          await onSaveScene(next);
          closeVoiceDialog();
        }}
      />
    </div>
  );
}
