import { useTranslation } from "react-i18next";
import { RiLightbulbLine } from "react-icons/ri";

export const Tip = () => {
  const { t } = useTranslation();
  return (
    <div className="mt-2 p-3 m-3 rounded-xl bg-yellow-50 border border-warning-100">
      <div className="flex items-center gap-1 mb-2">
        <RiLightbulbLine className="text-warning-dark text-sm" />
        <span className="text-xs font-bold text-warning-dark">{t("Mẹo nhỏ")}</span>
      </div>
      <ul className="space-y-1">
        <li className="text-xs text-warning-dark leading-relaxed">
          •{" "}
          {t(
            "Chủ đề Cốt Truyện: Hãy nhập chi tiết bối cảnh để AI tạo drama hay hơn (VD: Mẹ chồng khó tính, Sắp hết ăm...)"
          )}
          .
        </li>
        <li className="text-xs text-warning-dark leading-relaxed">
          • {t('Chọn "Mẹo Vật Cuộc Sống" cho các tip đon đẹp.')}.
        </li>
        <li className="text-xs text-warning-dark leading-relaxed">
          • {t("Visual Prompt luôn là Tiếng Anh để tối ưu cho AI về ảnh.")}.
        </li>
      </ul>
    </div>
  );
};
