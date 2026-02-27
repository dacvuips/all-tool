import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { CategoryService } from "../../../../../lib/repo";
import { VideoDialog } from "../../../../shared/common/video-dialog";
import { Editor, Field, ImageInput, Input, Label, Select } from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";

function flattenCategoryOptions(
  tree: { id?: string; name?: string; children?: any[] }[],
  level = 0
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const prefix = "— ".repeat(level);
  for (const n of tree) {
    if (!n.id) continue;
    options.push({ value: n.id, label: prefix + (n.name || "(Chưa đặt tên)") });
    if (n.children?.length) options.push(...flattenCategoryOptions(n.children, level + 1));
  }
  return options;
}

export function ProductField() {
  const { t } = useTranslation();
  const { watch } = useFormContext();
  const xs = useScreen("xs");
  const { userPermission } = useAuth();
  const [videoOpen, setVideoOpen] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    CategoryService.getCategoryTree().then((tree) => {
      setCategoryOptions(flattenCategoryOptions(tree));
    }).catch(() => setCategoryOptions([]));
  }, []);

  const videoUrl = watch("video");

  const getYoutubeVideoId = (url?: string): string | null => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtube")) {
        return parsed.searchParams.get("v");
      }
      if (parsed.hostname === "youtu.be") {
        return parsed.pathname.replace("/", "");
      }
    } catch {
      const shortMatch = url.match(/youtu\.be\/([\w-]+)/);
      if (shortMatch) return shortMatch[1];
    }
    return null;
  };

  const youtubeId = getYoutubeVideoId(videoUrl);
  const thumbnailSrc = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    : "https://img.youtube.com/vi/hqdefault.jpg";

  return (
    <>
      <Field name="name" label={t("Tên sản phẩm")} cols={5} required>
        <Input placeholder={t("Nhập tên sản phẩm")} />
      </Field>
      <Field name="coverImg" label={t("Hình ảnh bìa")} cols={5} required className="w-full">
        <ImageInput
          placeholder={t("Nhập link hoặc tải lên")}
          readOnly={!userPermission("EDIT_PRODUCT")}
        />
      </Field>

      <Field name="price" label={t("Giá sản phẩm")} cols={2}>
        <Input number placeholder={t("Nhập giá sản phẩm")} />
      </Field>

      <Field name="categoryIds" label={t("Danh mục hiển thị")} cols={12}>
        <Select
          multi
          options={categoryOptions}
          placeholder={t("Chọn danh mục (có thể chọn nhiều)")}
          clearable
        />
      </Field>

      <div className="col-span-full gap-2 mb-2 whitespace-nowrap">
        <Label text={t("Video")} />
        <div className={`flex ${xs ? "flex-row gap-2" : "flex-col"}`}>
          {videoUrl ? (
            <div
              onClick={() => {
                if (youtubeId) {
                  setVideoOpen(videoUrl);
                }
              }}
              className={`cursor-pointer ${xs ? "w-36" : "w-full"}`}
            >
              <Img src={thumbnailSrc} ratio169 />
            </div>
          ) : (
            <div className={`cursor-pointer ${xs ? "w-36" : "w-full"}`}>
              <Img ratio169 className="border border-dashed" />
            </div>
          )}

          <div className="w-full">
            <Field name="video" noError>
              <Input placeholder={`${t("Link video Youtube")}`} />
            </Field>
            <span className="block w-full whitespace-normal break-words text-gray-6 00 text-14">
              {`${t("Link video dạng")}: https://www.youtube.com/watch?v=XXXX`}
            </span>
          </div>
        </div>
      </div>
      <VideoDialog
        videoUrl={videoOpen}
        onClose={() => setVideoOpen("")}
        isOpen={!!videoOpen}
      ></VideoDialog>

      <Field name="des" label={t("Mô tả sản phẩm")} cols={12} required>
        <Editor minHeight="200px" noBorder className="rounded-md border" maxWidth="none" />
      </Field>
    </>
  );
}
