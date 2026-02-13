import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { uploadImage } from "../../../../lib/helpers/image";
import { useToast } from "../../../../lib/providers/toast-provider";

interface PropsType extends ReactProps {
  onUploadingChange?: (uploading: boolean) => any;
  onImageUploaded?: (image: string) => any;
  onImagesUploaded?: (images: string[]) => any;
  onRef: any;
  multiple?: boolean;
}

export function AvatarUploader({
  onRef,
  onUploadingChange,
  onImageUploaded,
  onImagesUploaded,
  multiple = false,
  ...props
}: PropsType) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    onRef(() => ({
      onClick,
    }));
  }, []);

  useEffect(() => {
    onUploadingChange(uploading);
  }, [uploading]);

  const onClick = () => {
    ref.current.click();
  };

  const onFilesChanged = async (e: ChangeEvent<HTMLInputElement>) => {
    let files = e.target.files;
    if (files.length == 0) return;

    try {
      setUploading(true);
      let tasks = [];
      for (let i = 0; i < files.length; i++) {
        tasks.push(uploadImage(files.item(i)));
      }
      const res = await Promise.all(tasks);
      onImagesUploaded(res.map((x) => x.link));
    } catch (err) {
      console.error(err);
      toast.error(t("Có ít nhất một ảnh upload không thành công."));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onFileChanged = async (e: ChangeEvent<HTMLInputElement>) => {
    let files = e.target.files;
    if (files.length == 0) return;

    let file = files[0];
    try {
      setUploading(true);
      let res = await uploadImage(file);
      onImageUploaded(res.link);
    } catch (err) {
      console.error(err);
      toast.error(t("Upload ảnh thất bại."));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        hidden
        multiple={multiple}
        type="file"
        accept="image/*"
        ref={ref}
        onChange={multiple ? onFilesChanged : onFileChanged}
      />
    </>
  );
}
