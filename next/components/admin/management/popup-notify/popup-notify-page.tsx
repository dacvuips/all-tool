import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactPlayer from "react-player";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { PopupNotify, PopupNotifyService } from "../../../../lib/repo/list/popup-notify.repo";
import { DatePicker, Field, Select } from "../../../shared/utilities/form";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { PopupNotifySlideout } from "./components/popup-notify-slideout";

export function PopupNotifyPage(props) {
  const { t } = useTranslation();

  const router = useRouter();
  const { userPermission } = useAuth();
  const [popupNotifyId, setPopupNotifyId] = useState<string>(null);
  const [filter, setFilter] = useState<any>({});
  const [startDate, setStartDate] = useState<any>(null);
  const [endDate, setEndDate] = useState<any>(null);
  const { POPUP_NOTIFY_STATUS_OPTIONS, POPUP_NOTIFY_TYPE_OPTIONS } = useOptionsTranslation();

  useEffect(() => {
    if (router.query["create"]) {
      setPopupNotifyId("");
    } else if (router.query["id"]) {
      setPopupNotifyId(router.query["id"] as string);
    } else {
      setPopupNotifyId(null);
    }
  }, [router.query]);

  useEffect(() => {
    setFilter({
      ...(startDate ? { startDate: { $gte: startDate.startDate, $lte: startDate.endDate } } : {}),
      ...(endDate ? { endDate: { $gte: endDate.startDate, $lte: endDate.endDate } } : {}),
    });
  }, [startDate, endDate]);

  return (
    <Card>
      <DataTable<PopupNotify>
        crudService={PopupNotifyService}
        order={{ priority: -1 }}
        filter={filter}
        updateItem={(item) => {
          router.replace({ pathname: location.pathname, query: { id: item.id } });
        }}
        createItem={() => {
          router.replace({ pathname: location.pathname, query: { create: true } });
        }}
      >
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            <DataTable.Button
              primary
              isAddButton
              disabled={!userPermission("CREATE_POPUP_NOTIFY")}
            />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search />
          <DataTable.Filter>
            <Field noError>
              <DatePicker
                className="w-52"
                value={startDate}
                onChange={setStartDate}
                selectsRange
                fullHeader
                placeholder={t("Lọc thời gian bắt đầu")}
                clearable
              />
            </Field>
            <Field noError>
              <DatePicker
                className="w-56"
                value={endDate}
                onChange={setEndDate}
                selectsRange
                fullHeader
                placeholder={t("Lọc thời gian kết thúc")}
                clearable
              />
            </Field>
            <Field name="type" noError>
              <Select
                className="w-40"
                clearable
                options={POPUP_NOTIFY_TYPE_OPTIONS}
                placeholder={t("Lọc theo loại")}
              />
            </Field>
            <Field name="status" noError>
              <Select
                className="w-40"
                clearable
                options={POPUP_NOTIFY_STATUS_OPTIONS}
                placeholder={t("Lọc trạng thái")}
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4">
          <DataTable.Column
            width={160}
            label={t("Thời gian")}
            render={(item: PopupNotify) => (
              <>
                <div className="flex gap-1">
                  <span className="font-semibold whitespace-nowrap">{`${t("Bắt đầu")}: `}</span>{" "}
                  <DataTable.CellDate value={item.startDate} format="dd-MM-yyyy" />
                </div>
                <div className="flex gap-1">
                  <span className="font-semibold whitespace-nowrap">{`${t("Kết thúc")}: `}</span>{" "}
                  {item.endDate ? (
                    <DataTable.CellDate value={item.endDate} format="dd-MM-yyyy" />
                  ) : (
                    t("Không có")
                  )}
                </div>
              </>
            )}
          />

          <DataTable.Column
            label={t("Tên thông báo")}
            width={180}
            render={(item: PopupNotify) => <DataTable.CellText value={item.name} />}
          />
          <DataTable.Column
            center
            width={100}
            label={t("Nội dung")}
            render={(item: PopupNotify) => {
              if (item.type === "IMAGE") {
                return (
                  <DataTable.CellImage
                    ratio169
                    imageDialogClassName="border-2 border-white rounded-md"
                    value={item.data}
                  />
                );
              }
              if (item.type === "VIDEO") {
                return (
                  <ReactPlayer
                    url={item.data as string}
                    width="240px"
                    height="140px"
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
                );
              } else {
                return <DataTable.CellText className="font-bold" value={"<HTML/>"} />;
              }
            }}
          />

          <DataTable.Column
            center
            label={t("Ưu tiên")}
            render={(item: PopupNotify) => <DataTable.CellText value={item.priority} />}
          />
          <DataTable.Column
            center
            label={t("Loại")}
            render={(item: PopupNotify) => (
              <DataTable.CellStatus options={POPUP_NOTIFY_TYPE_OPTIONS} value={item.type} />
            )}
          />
          <DataTable.Column
            right
            label={t("Trạng thái")}
            render={(item: PopupNotify) => (
              <DataTable.CellStatus options={POPUP_NOTIFY_STATUS_OPTIONS} value={item.status} />
            )}
          />
          <DataTable.Column
            right
            render={(item: PopupNotify) => (
              <>
                <DataTable.CellButton
                  value={item}
                  isEditButton
                  disabled={!userPermission("EDIT_POPUP_NOTIFY")}
                />
                <DataTable.CellButton
                  hoverDanger
                  value={item}
                  isDeleteButton
                  disabled={!userPermission("DELETE_POPUP_NOTIFY")}
                />
              </>
            )}
          />
        </DataTable.Table>

        <DataTable.Pagination />
        <DataTable.Consumer>
          {({ loadAll }) => <PopupNotifySlideout id={popupNotifyId} onSubmit={loadAll} />}
        </DataTable.Consumer>
      </DataTable>
    </Card>
  );
}
