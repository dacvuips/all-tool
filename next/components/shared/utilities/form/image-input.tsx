import _, { isEqual } from "lodash";
import { ChangeEvent, MutableRefObject, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCloseLine,
  RiStarLine,
  RiUpload2Line,
} from "react-icons/ri";
import { uploadImage } from "../../../../lib/helpers/image";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Img } from "../misc/img";
import { Button } from "./button";

export type CompressOptions = {
  width?: number;
  height?: number;
  quality?: number;
  type?: "JPEG" | "PNG" | "WEBP";
};
export interface ImageInputProps extends FormControlProps {
  multi?: boolean;
  inputClassName?: string;
  imgUrlClassName?: string;
  buttonClassName?: string;
  avatar?: boolean;
  largeImage?: boolean;
  ratio169?: boolean;
  percent?: number;
  contain?: boolean;
  cover?: boolean;
  checkerboard?: boolean;
  cols?: Cols;
  compress?: number;
  hasFirstImage?: boolean | string;
  noImage?: boolean;
  limit?: number; //Giới hạn số ảnh úp tối đa 1 lần
  compressUpload?: boolean; //Nén ảnh khi upload
  compressUploadOptions?: CompressOptions; //Lựa chọn cấu hình nén ảnh
}
export function ImageInput({
  controlClassName = "form-control",
  className = "",
  inputClassName = "",
  buttonClassName = "",
  imgUrlClassName = "",
  hasFirstImage = false,
  style = {},
  multi = false,
  noImage = false,
  limit = 1,
  compressUpload = false,
  compressUploadOptions = {},
  ...props
}: ImageInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState<string | string[]>();
  const [url, setUrl] = useState("");
  const ref: MutableRefObject<HTMLInputElement> = useRef();
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileRejectionItems, setFileRejectionItems] = useState<string>(null);
  const toast = useToast();
  const { getRootProps, getInputProps, fileRejections } = useDropzone({
    accept: {
      "image/png": [],
      "image/jpg": [],
      "image/jpeg": [],
    },
    disabled: props.readOnly,
    onDrop: (acceptedFiles) => {
      onFileChanged(acceptedFiles, true);
    },

    maxFiles: limit,
  });

  const errorFirst = _.chain(fileRejections)
    .flatMap("errors")
    .map("code")
    .compact()
    .first()
    .value();
  const ErrorFile: any = [
    { code: "file-invalid-type", message: t("Sai định dạng ảnh PNG,JPG,JPEG") },
    {
      code: "too-many-files",
      message: `*${t("Vượt quá số lượng file tải lên cùng lúc là")} (${limit})`,
    },
  ];
  useEffect(() => {
    ErrorFile.map((item) => {
      if (item.code == errorFirst) {
        setFileRejectionItems(item.message);
        return;
      }
    });
  }, [fileRejections]);

  useEffect(() => {
    if (!isEqual(props.value, value)) {
      if (props.value !== undefined) {
        setValue(props.value || getDefaultValue({ multi }));
      } else {
        setValue(getDefaultValue({ multi }));
      }
    }
  }, [props.value]);

  const onFileChanged = async (e: ChangeEvent<HTMLInputElement> | any, drag?: boolean) => {
    setFileRejectionItems(null);
    let files = !drag ? e.target.files : e;

    if (files.length == 0) return;
    if (files.length > limit) {
      setFileRejectionItems(`*${t("Vượt quá số lượng file tải lên cùng lúc là")} (${limit})`);
      return;
    }
    if (multi) {
      try {
        setUploading(true);
        let tasks = [];
        for (let i = 0; i < files.length; i++) {
          tasks.push(
            uploadImage(!drag ? files.item(i) : files[i], compressUpload, compressUploadOptions)
          );
        }
        let res = await Promise.all(tasks);
        let images = res.map((x) => x.link);
        const newImages = [...((value as string[]) || []), ...images];
        setValue(newImages);
        if (props.onChange) props.onChange(newImages);
      } catch (err) {
        console.error(err);
        toast.error(t("Upload ảnh thất bại. Xin thử lại bằng url thay vì upload."));
      } finally {
        setUploading(false);
        // e.target.value = "";
      }
    } else {
      let file = files[0];
      try {
        setUploading(true);
        let res = await uploadImage(file, compressUpload, compressUploadOptions);
        setValue(res.link);
        if (props.onChange) props.onChange(res.link);
      } catch (err) {
        console.error(err);
        toast.error(t("Upload ảnh thất bại. Xin thử lại bằng url thay vì upload."));
      } finally {
        setUploading(false);
        // e.target.value = "";
      }
    }
  };

  const onAddImage = () => {
    if (url) {
      let newValue = (value || []).concat(url);
      setValue(newValue);
      setUrl("");
      if (props.onChange) props.onChange(newValue);
    } else {
      alert(t("Yêu cầu nhập đường dẫn ảnh"));
    }
  };
  // bắt sự kiên kéo thả vào ô mong muốn
  const handleDragEnter = (e) => {
    e.preventDefault();
    !props.readOnly && setIsDragging(true);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <>
      {multi ? (
        <>
          <div className={`grid mb-2 gap-3 grid-cols-${props.cols || 4}`}>
            {!!value?.length &&
              Array.isArray(value) &&
              (value as string[]).map((image, index) => (
                <Img
                  // compress={props.compress || 200}
                  key={index}
                  className="border border-gray-400 group"
                  showImageOnClick
                  contain={props.contain || !props.cover}
                  checkerboard={props.checkerboard}
                  ratio169={props.ratio169}
                  percent={props.percent}
                  src={image}
                  avatar={props.avatar}
                  lazyload={false}
                >
                  {index != 0 && (
                    <Button
                      outline
                      primary
                      className="absolute -bottom-1 -left-2 px-0 w-8 h-8 bg-white rounded-full opacity-0 group-hover:opacity-100"
                      icon={<RiArrowLeftLine />}
                      onClick={() => {
                        let newValue = [...(value as string[])];
                        let temp = newValue[index - 1];
                        newValue[index - 1] = newValue[index];
                        newValue[index] = temp;
                        setValue(newValue);
                        if (props.onChange) props.onChange(newValue);
                      }}
                    />
                  )}
                  <Button
                    outline
                    danger
                    className="absolute -bottom-1 left-1/2 px-0 w-8 h-8 bg-white rounded-full opacity-0 transform -translate-x-1/2 group-hover:opacity-100"
                    icon={<RiCloseLine />}
                    onClick={() => {
                      (value as string[]).splice(index, 1);
                      let newValue = [...(value as string[])];
                      setValue(newValue);
                      if (props.onChange) props.onChange(newValue);
                    }}
                  />
                  {index != value.length - 1 && (
                    <Button
                      outline
                      primary
                      className="absolute -bottom-1 -right-2 px-0 w-8 h-8 bg-white rounded-full opacity-0 group-hover:opacity-100"
                      icon={<RiArrowRightLine />}
                      onClick={() => {
                        let newValue = [...(value as string[])];
                        let temp = newValue[index + 1];
                        newValue[index + 1] = newValue[index];
                        newValue[index] = temp;
                        setValue(newValue);
                        if (props.onChange) props.onChange(newValue);
                      }}
                    />
                  )}
                  {hasFirstImage && index == 0 && (
                    <i
                      className="absolute -top-2 -right-2 p-2 bg-white rounded-full border text-primary border-primary"
                      data-tooltip={hasFirstImage || t("Ảnh đại diện")}
                    >
                      <RiStarLine />
                    </i>
                  )}
                </Img>
              ))}
            <div {...getRootProps({ className: "dropzone" })}>
              <input {...getInputProps()} />

              <Img
                className={`border-2 cursor-pointer border-dashed hover:border-primary ${
                  uploading || isDragging ? "border-primary" : ""
                }`}
                contain={props.contain || !props.cover}
                checkerboard={props.checkerboard}
                ratio169={props.ratio169}
                percent={props.percent}
                src={"/assets/default/add-img.png"}
                avatar={props.avatar}
                lazyload={false}
              ></Img>
            </div>
          </div>

          <div className={`flex items-center ${imgUrlClassName}`}>
            <input
              tabIndex={props.noFocus && -1}
              className={`${controlClassName} mt-0 flex-1 rounded-r-none ${inputClassName || ""}`}
              placeholder={props.placeholder || t("Nhập đường dẫn ảnh")}
              readOnly={props.readOnly}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.code === "Enter") {
                  e.preventDefault();
                  onAddImage();
                }
              }}
            />
            <Button
              outline
              className={`flex-grow-0 flex-shrink-0 px-3 bg-white rounded-l-none ${buttonClassName}`}
              text={t("Thêm")}
              unfocusable
              disabled={props.readOnly}
              onClick={() => {
                onAddImage();
              }}
            />
            <span className="px-2 font-semibold">{t("hoặc")}</span>
            <Button
              outline
              className={`flex-grow-0 flex-shrink-0 px-3 bg-white ${buttonClassName}`}
              icon={<RiUpload2Line />}
              text={t("Tải lên")}
              unfocusable
              disabled={props.readOnly}
              isLoading={uploading}
              onClick={() => ref.current?.click()}
            />

            <input
              hidden
              multiple
              type="file"
              accept="image/*"
              ref={ref}
              onChange={onFileChanged}
            />
          </div>
          {fileRejectionItems && (
            <div className="w-full">
              <span className="text-danger">{fileRejectionItems}</span>
            </div>
          )}
        </>
      ) : (
        <>
          {props.largeImage && (
            <>
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {!isDragging &&
                  (!value ? (
                    <div {...getRootProps({ className: "dropzone" })}>
                      <input {...getInputProps()} />
                      <div className={`border-2 border-dashed cursor-pointer hover:border-primary`}>
                        <Img
                          lazyload={false}
                          contain={props.contain || !props.cover}
                          checkerboard={props.checkerboard}
                          ratio169={props.ratio169}
                          percent={props.percent}
                          avatar={props.avatar}
                          src="/assets/default/drag-drop.png"
                        />
                      </div>
                    </div>
                  ) : (
                    <Img
                      // compress={props.compress || 400}
                      className="w-full bg-gray-100 rounded-t border border-b-0 border-gray-400"
                      showImageOnClick
                      contain={props.contain || !props.cover}
                      checkerboard={props.checkerboard}
                      ratio169={props.ratio169}
                      percent={props.percent}
                      src={(value as string) || ""}
                      avatar={props.avatar}
                      lazyload={false}
                    />
                  ))}
                {isDragging && (
                  <div {...getRootProps({ className: "dropzone" })}>
                    <input {...getInputProps()} />
                    <div
                      className={`border-2 cursor-pointer border-dashed hover:border-primary ${
                        uploading || isDragging ? "border-primary" : ""
                      }`}
                    >
                      <Img
                        lazyload={false}
                        contain={props.contain || !props.cover}
                        checkerboard={props.checkerboard}
                        ratio169={props.ratio169}
                        percent={props.percent}
                        avatar={props.avatar}
                        src="/assets/default/drag-drop.png"
                      />
                    </div>{" "}
                  </div>
                )}
              </div>
            </>
          )}

          <div
            className={`${controlClassName} mt-0 relative flex items-center focus-within:border-primary-dark group px-0 ${
              props.readOnly ? "readOnly" : ""
            } ${props.error ? "error" : ""} ${
              props.largeImage ? "rounded-t-none" : ""
            } ${className}`}
            style={{ ...style }}
          >
            {!noImage && !props.largeImage && (
              <Img
                compress={props.compress || 80}
                contain={props.contain}
                className="flex-shrink-0 self-stretch p-1 w-10"
                src={(value as string) || ""}
                avatar={props.avatar}
                showImageOnClick
                lazyload={false}
              />
            )}

            <input
              tabIndex={props.noFocus && -1}
              className={`flex-grow bg-transparent self-stretch ${
                props.largeImage ? "px-3" : "px-1.5"
              } ${inputClassName || ""}`}
              name={props.name}
              value={value || ""}
              placeholder={props.placeholder}
              readOnly={props.readOnly}
              onChange={(e) => {
                setValue(e.target.value);
                if (props.onChange) props.onChange(e.target.value);
              }}
            />

            {!props.readOnly && (
              <Button
                className={`self-stretch px-3 bg-gray-50 rounded-l-none border-l border-gray-300 ${buttonClassName}`}
                isLoading={uploading}
                tooltip={t("Tải lên")}
                icon={<RiUpload2Line />}
                unfocusable
                onClick={() => ref.current?.click()}
              ></Button>
            )}
            <input hidden type="file" accept="image/*" ref={ref} onChange={onFileChanged} />
          </div>
          {fileRejectionItems && (
            <div className="w-full">
              <span className="text-danger">{fileRejectionItems}</span>
            </div>
          )}
        </>
      )}
    </>
  );
}

const getDefaultValue = (props: ImageInputProps) => {
  return props.multi ? [] : "";
};

ImageInput.getDefaultValue = getDefaultValue;
