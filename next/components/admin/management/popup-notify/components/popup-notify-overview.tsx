import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import ReactPlayer from "react-player";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { PopupNotify, PopupNotifyService } from "../../../../../lib/repo/list/popup-notify.repo";
import { PopupNotifyTypeEnum } from "../../../../../lib/repo/types";
import {
  DatePicker,
  Editor,
  Field,
  Form,
  ImageInput,
  Input,
  Select,
  Switch,
} from "../../../../shared/utilities/form";

export function PopupNotifyOverviewTab({
  popupNotify,
  loadAll,
}: {
  popupNotify: PopupNotify;
  loadAll: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();

  const onSubmit = async (data) => {
    // check date
    if (!!data.endDate && new Date(data.startDate).getTime() > new Date(data.endDate).getTime()) {
      toast.error(t("Ngày bắt đầu phải nhỏ hơn ngày kết thúc"));
      return;
    }
    await PopupNotifyService.createOrUpdate({
      id: popupNotify.id,
      data: {
        ...data,
      },
    })
      .then((res) => {
        toast.success(`${popupNotify.id ? t("Cập nhật") : t("Tạo")} ${t("thông báo thành công")}`);

        loadAll();
      })
      .catch((err) => {
        console.error(err);
        toast.error(
          `${popupNotify.id ? t("Cập nhật") : t("Tạo")} ${t("thông báo thất bại")}. ${err.message}`
        );
      });
  };

  return (
    <>
      <Form grid defaultValues={popupNotify} onSubmit={onSubmit}>
        <PopupNotifyOverviewField />
        <Form.Footer
          className="lg:pb-0 pb-14"
          cancelText=""
          submitProps={{ disabled: !userPermission("EDIT_POPUP_NOTIFY") }}
        />
      </Form>
    </>
  );
}

function PopupNotifyOverviewField() {
  const { t } = useTranslation();
  const { watch, setValue, register } = useFormContext();
  register("status");
  const sm = useScreen("sm");
  const isActive = watch("status") == "ACTIVE";
  const type = watch("type");
  const videoUrl = watch("data");
  const { POPUP_NOTIFY_TYPE_OPTIONS, POPUP_NOTIFY_ACTION_TYPE_OPTIONS } = useOptionsTranslation();

  return (
    <>
      <Field name="name" label={t("Tên thông báo")} cols={sm ? 6 : 12} required>
        <Input placeholder={t("Nhập têm thông báo")} />
      </Field>
      <Field name="description" label={t("Mô tả")} cols={sm ? 6 : 12} required>
        <Input placeholder={t("Nhập mô tả")} />
      </Field>
      <Field name="startDate" label={t("Ngày bắt đầu")} cols={sm ? 6 : 12} required>
        <DatePicker
          defaultValue={new Date()}
          minDate={new Date()}
          placeholder={t("Nhập ngày bắt đầu")}
        />
      </Field>
      <Field name="endDate" label={t("Ngày kết thúc")} cols={sm ? 6 : 12}>
        <DatePicker
          minDate={
            new Date(watch("startDate")).getTime() > new Date().getTime()
              ? watch("startDate")
              : new Date()
          }
          placeholder={t("Nhập ngày kết thúc")}
        />
      </Field>
      <Field name="type" label={t("Loại thông báo")} cols={sm ? 4 : 12} required>
        <Select
          options={POPUP_NOTIFY_TYPE_OPTIONS}
          placeholder={t("Chọn loại thông báo")}
          clearable
        />
      </Field>

      <Field name="priority" label={t("Độ ưu tiên")} cols={sm ? 4 : 12} required>
        <Input type="number" placeholder={t("Nhập thứ tự ưu tiên")} />
      </Field>

      <Field label={t("Trạng thái")} cols={sm ? 4 : 12}>
        <Switch
          value={isActive}
          onChange={(value) => {
            setValue("status", value == true ? "ACTIVE" : "INACTIVE");
          }}
          placeholder={t("Kích hoạt")}
        />
      </Field>
      {type == PopupNotifyTypeEnum.IMAGE && (
        <>
          <Field name="link" label={t("Link website")} cols={sm ? 8 : 12} required>
            <Input placeholder={t("Nhập link của trang web")} />
          </Field>
          <Field name="action" label={t("Hành động")} cols={sm ? 4 : 12} required>
            <Select options={POPUP_NOTIFY_ACTION_TYPE_OPTIONS} />
          </Field>
        </>
      )}
      {!!type && (
        <Field name="data" label={t("Nội dung")} cols={12} required>
          {type == PopupNotifyTypeEnum.VIDEO ? (
            <Input placeholder={`${t("Nhập url")} (https://) youtube, facebook`} />
          ) : type == PopupNotifyTypeEnum.HTML ? (
            <Editor
              maxHeight="calc(100vh - 150px)"
              name="data"
              noBorder
              placeholder={t("Nhập nội dung thông báo")}
            />
          ) : (
            <ImageInput largeImage ratio169 imgUrlClassName="h-96" />
          )}
        </Field>
      )}
      {type == PopupNotifyTypeEnum.VIDEO && (
        <div className="col-span-full">
          <ReactPlayer
            url={videoUrl}
            width={"100%"}
            height="400px"
            controls
            config={{
              youtube: {
                playerVars: { showinfo: 1, origin: "/" },
              },
              file: {
                attributes: {
                  controlsList: "nodownload",
                },
              },
            }}
          />
        </div>
      )}
    </>
  );
}
