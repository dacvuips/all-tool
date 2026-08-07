import { useTranslation } from "react-i18next";
import { FilmSceneRecord } from "./film-types";

type Props = {
  scenes: FilmSceneRecord[];
  selectedId: string | null;
  totalDurationSec: number;
  onSelect: (id: string) => void;
};

export default function FilmStoryboardSceneList({
  scenes,
  selectedId,
  totalDurationSec,
  onSelect,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3.5 border-b border-gray-50">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900 m-0">{t("Chuỗi Cảnh quay")}</h3>
          <span className="text-xs font-semibold text-gray-500">{totalDurationSec}s</span>
        </div>
        <p className="text-xs text-gray-400 m-0 mt-1">
          {t("Kiểm tra nội dung & trạng thái theo thứ tự Cảnh quay")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {scenes.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10 px-4">
            {t("Chưa có cảnh quay. Bấm Trích xuất ở Nội dung gốc hoặc Thêm cảnh.")}
          </div>
        ) : (
          scenes.map((scene) => {
            const selected = scene.id === selectedId;
            const snippet = scene.summary || scene.action || scene.dialogue || "";
            const short =
              snippet.length > 90 ? `${snippet.slice(0, 90)}…` : snippet || t("Chưa có mô tả");
            const charCount = scene.characterNames?.length || 0;
            const statusDot =
              scene.mediaStatus === "ready"
                ? "bg-green-500"
                : scene.mediaStatus === "error"
                  ? "bg-red-400"
                  : "bg-yellow-400";

            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => onSelect(scene.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
                  selected
                    ? "border-blue-400 bg-blue-50 shadow-sm"
                    : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-blue-600 flex-shrink-0">
                    #{String(scene.index).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800">
                        {scene.shotSize || t("Cảnh quay")}
                      </span>
                      <span className="text-10 text-gray-400">
                        {charCount} {t("Nhân vật")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 m-0 mt-1 leading-relaxed line-clamp-2">
                      {short}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-10 text-gray-400">
                      <span className="font-medium text-gray-500">{scene.durationSec || 0}s</span>
                      {scene.location && (
                        <>
                          <span>·</span>
                          <span className="truncate">{scene.location}</span>
                        </>
                      )}
                      <span className={`ml-auto w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
