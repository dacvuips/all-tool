import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { AuthorityService, User, UserService } from "../../../../lib/repo";
// import { AuthorityService } from "../../../../lib/repo/authority.repo";

import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { DatePicker } from "../../../shared/utilities/form";
import { Field } from "../../../shared/utilities/form/field";
import { Input } from "../../../shared/utilities/form/input";
import { Select } from "../../../shared/utilities/form/select";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { UserSlideout } from "./components/user-slideout";
export function UserPage(props) {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const [userId, setUserId] = useState(null);
  const { user, userPermission } = useAuth();
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);
  const router = useRouter();
  const { USER_ROLES_OPTION } = useOptionsTranslation();

  useEffect(() => {
    if (router.query["id"]) {
      setUserId(router.query["id"]);
    } else {
      setUserId(null);
    }
  }, [router.query]);
  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
    });
  }, [timeRange]);

  return (
    <Card>
      <DataTable<User>
        crudService={UserService}
        order={{ createdAt: -1 }}
        filter={
          (user.role !== "ADMIN" && { role: { $ne: "ADMIN" }, _id: { $ne: user.id } }, filter)
        }
        updateItem={(item) => {
          router.replace({ pathname: location.pathname, query: { id: item.id } });
        }}
      >
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            <DataTable.Button primary isAddButton disabled={!userPermission("CREATE_USER")} />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search />
          <DataTable.Filter>
            <Field noError>
              <DatePicker
                className="w-40"
                value={timeRange}
                onChange={setTimeRange}
                selectsRange
                fullHeader
                placeholder={t("Lọc thời gian")}
                clearable
              />
            </Field>
            <Field name="role" noError className="w-52">
              <Select
                placeholder={t("Tất cả loại tài khoản")}
                clearable
                options={USER_ROLES_OPTION}
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4">
          <DataTable.Column
            label={t("Email")}
            render={(item: User) => <DataTable.CellText value={item.email} />}
          />
          <DataTable.Column
            center
            label={t("Họ tên")}
            render={(item: User) => <DataTable.CellText className="min-w-2xs" value={item.name} />}
          />

          <DataTable.Column
            center
            label={t("Ngày tạo")}
            render={(item: User) => (
              <DataTable.CellDate className="min-w-2xs" value={item.createdAt} />
            )}
          />
          <DataTable.Column
            right
            orderBy="role"
            label={t("Vai trò")}
            render={(item: User) => (
              <DataTable.CellStatus value={item.role} options={USER_ROLES_OPTION} />
            )}
          />
          <DataTable.Column
            right
            className="whitespace-nowrap"
            render={(item: User) => (
              <>
                <DataTable.CellButton value={item} isEditButton />
                <DataTable.CellButton
                  hoverDanger
                  value={item}
                  isDeleteButton
                  disabled={
                    item.id == user.id ||
                    (item.role == "ADMIN" && item.root) ||
                    !userPermission("DELETE_USER")
                  }
                />
              </>
            )}
          />
        </DataTable.Table>
        <DataTable.Pagination />

        <DataTable.Form
          grid
          beforeSubmit={(data) => {
            return { ...data, reTypePassword: undefined };
          }}
          slideFromBottom="none"
        >
          <Field
            label={t("Email đăng nhập")}
            name="email"
            cols={sm ? 6 : 12}
            validation={{ email: true }}
            required
          >
            <Input autoFocus />
          </Field>
          <Field label={t("Họ tên")} name="name" cols={sm ? 6 : 12} required>
            <Input />
          </Field>

          <Field
            label={t("Mật khẩu")}
            name="password"
            validation={{ min: 6 }}
            cols={sm ? 6 : 12}
            required
          >
            <Input type="password" />
          </Field>
          <Field
            label={t("Xác nhận mật khẩu mới")}
            name="reTypePassword"
            required
            cols={sm ? 6 : 12}
            validation={{
              confirmPassword: (value, values) => {
                if (value !== values["password"]) return t("Mật khẩu xác nhận không khớp");
                return "";
              },
              min: 6,
            }}
          >
            <Input type="password" />
          </Field>

          <Field label={t("Phân quyền")} name="authorityId" required cols={sm ? 6 : 12}>
            <Select
              autocompletePromise={(props) =>
                AuthorityService.getAllAutocompletePromise(props, {
                  query: {
                    filter: {
                      root: user.role != "ADMIN" ? false : undefined,
                      parentIds: user.role != "ADMIN" ? { $in: [user.authorityId] } : undefined,
                    },
                  },
                  fragment: "id name",
                  parseOption: (data) => ({
                    value: data.id,
                    label: data.name,
                  }),
                })
              }
            />
          </Field>
          <Field label={t("Vai trò")} name="role" required cols={sm ? 6 : 12}>
            <Select
              options={
                user.role == "ADMIN"
                  ? USER_ROLES_OPTION
                  : [{ value: "PARTNER", label: t("Cộng tác viên"), color: "orange" }]
              }
            />
          </Field>
        </DataTable.Form>

        <DataTable.Consumer>
          {({ loadAll }) => <UserSlideout userId={userId} loadAll={loadAll} onSubmit={loadAll} />}
        </DataTable.Consumer>
      </DataTable>
    </Card>
  );
}
