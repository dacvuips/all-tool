import { useTranslation } from "react-i18next";
import { RiLightbulbLine } from "react-icons/ri";

export const Tip = () => {
  const { t } = useTranslation();
  return (
    <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
      <div className="flex items-center gap-1 mb-2">
        <RiLightbulbLine className="text-amber-500 text-sm" />
        <span className="text-xs font-bold text-amber-700">{t("Mẹo nhỏ")}</span>
      </div>
      <ul className="space-y-1">
        <li className="text-xs text-amber-700 leading-relaxed">
          •{" "}
          {t(
            "Chủ đề Cốt Truyện: Hãy nhập chi tiết bối cảnh để AI tạo drama hay hơn (VD: Mẹ chồng khó tính, Sắp hết ăm...)"
          )}
          .
        </li>
        <li className="text-xs text-amber-700 leading-relaxed">
          • {t('Chọn "Mẹo Vật Cuộc Sống" cho các tip đon đẹp.')}.
        </li>
        <li className="text-xs text-amber-700 leading-relaxed">
          • {t("Visual Prompt luôn là Tiếng Anh để tối ưu cho AI về ảnh.")}.
        </li>
      </ul>
    </div>
  );
};
