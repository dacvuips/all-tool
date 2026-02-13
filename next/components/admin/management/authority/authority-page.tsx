import { cloneDeep } from "lodash-es";
import { useEffect, useState } from "react";
import { Scrollbars } from "react-custom-scrollbars";
import { useTranslation } from "react-i18next";
import {
  HiKey,
  HiOutlineKey,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi";
import { RiCheckboxBlankFill } from "react-icons/ri";
import { useAlert } from "../../../../lib/providers/alert-provider";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  Authority,
  AuthorityFeature,
  AuthorityGroup,
  AuthorityScope,
  AuthorityService,
} from "../../../../lib/repo/authority";

import {
  Button,
  Checkbox,
  Field,
  Form,
  Input,
  Label,
  Select,
} from "../../../shared/utilities/form";
import { Card, Spinner } from "../../../shared/utilities/misc";

export function AuthorityPage() {
  const { t } = useTranslation();

  const [authorities, setAuthorities] =
    useState<Partial<Authority & { children: Authority[] }>[]>();
  const [authorityId, setAuthorityId] = useState<string>();
  const [authority, setAuthority] = useState<Authority>();
  const [openAuthorityDialog, setOpenAuthorityDialog] = useState<Authority>(undefined);
  const toast = useToast();
  const alert = useAlert();
  const { userPermission } = useAuth();
  const { user } = useAuth();
  useEffect(() => {
    loadAuthorities(true);
  }, []);

  const loadAuthorities = (resetAuthorityId?: boolean) => {
    AuthorityService.getAll({
      query: { limit: 0 },
    })
      .then((res) => {
        const response = cloneDeep(res);
        let rootAuthority = response.data.find((authority) => authority.root);
        if (rootAuthority) {
          return response;
        }
        //  {
        //   rootAuthority = response.data.find((authority) => authority.id === user.authorityIds[0]);
        // }
        else
          response.data.forEach((authority: any) => {
            if (authority.id === rootAuthority?.id) {
              authority.root = true;
            }
          });
        return response;
      })
      .then((res) => {
        let authorities = cloneDeep(res.data);

        let rootAuthorities = authorities.filter((x) => x.root);
        const attachAuthorityChildren = (authority: Authority, authorities: Authority[]) => {
          authority.children = authorities.filter(
            (x) => x.parentIds && x.parentIds[0] === authority.id
          );
          for (let child of authority.children) {
            attachAuthorityChildren(child, authorities);
          }
        };
        for (let authority of rootAuthorities) {
          attachAuthorityChildren(authority, authorities);
        }

        // setAuthorities(authoritigites);
        setAuthorities(rootAuthorities);
        if (resetAuthorityId) setAuthorityId(res.data[0]?.id);
      });
  };

  useEffect(() => {
    setAuthority(null);
    if (authorityId) {
      AuthorityService.getOne({
        id: authorityId,
      }).then((res) => {
        setAuthority(res);
      });
    }
  }, [authorityId]);
  console.log(user, authority);
  return (
    <div
      className="flex rounded border-group"
      style={{
        height: "calc(100vh - 84px)",
      }}
    >
      <Card className="flex flex-col px-0 py-0 w-80">
        <div className="px-4 py-2">
          <Label
            className="text-xl"
            text={t("Phân quyền")}
            description={t("Cấu hình các phân quyền hệ thống")}
          />
        </div>
        <Scrollbars
          className="p-4 border-t border-b border-gray-200 v-scrollbar"
          style={{ height: "calc(100% - 134px)" }}
        >
          <div className="p-4">
            {authorities?.map((child, index) => (
              <AuthorityBranch
                key={child.id}
                authority={child}
                authorityId={authorityId}
                isLast={index == authorities.length - 1}
                onClick={(child) => {
                  // console.log(child);
                  setAuthorityId(child.id);
                }}
              />
            ))}
          </div>
        </Scrollbars>
        <div className="flex items-center flex-1 px-4 gap-x-3">
          <Button
            outline
            hoverSuccess
            text={t("Tạo")}
            className="flex-1 px-0"
            icon={<HiOutlinePlus />}
            onClick={() => {
              if (!authority) return;
              setOpenAuthorityDialog({
                parent: authority,
                parentId: authority.id,
              });
            }}
            disabled={
              (user.role != "ADMIN" && !authority?.parentIds.includes(user.authorityId)) ||
              !userPermission("CREATE_AUTHORITY")
            }
          />
          <Button
            outline
            hoverAccent
            text={t("Sửa")}
            className="flex-1 px-0"
            icon={<HiOutlinePencil />}
            onClick={() => {
              if (!authority) return;
              setOpenAuthorityDialog(authority);
            }}
            disabled={
              user.authorityId == authority?.id ||
              authority?.root == true ||
              (user.role != "ADMIN" && !authority?.parentIds.includes(user.authorityId)) ||
              !userPermission("EDIT_AUTHORITY")
            }
          />
          <Button
            outline
            hoverDanger
            text={t("Xoá")}
            className="flex-1 px-0"
            icon={<HiOutlineTrash />}
            onClick={() => {
              if (!authority) return;
              alert.danger(
                t("Xoá phân quyền"),
                t(`Bạn có chắc chắn muốn xoá phân quyền "${authority.name}" không?`),
                t("Xoá phân quyền"),
                async () => {
                  await AuthorityService.delete({ id: authority.id, toast });
                  await loadAuthorities(true);
                  return true;
                }
              );
            }}
            disabled={
              user.authorityId == authority?.id ||
              authority?.root == true ||
              (user.role != "ADMIN" && !authority?.parentIds.includes(user.authorityId)) ||
              !userPermission("DELETE_AUTHORITY")
            }
          />
        </div>
      </Card>
      <Card className="flex-1 px-0 py-0 min-w-screen-sm">
        {authorities ? (
          <>
            <Scrollbars
              className="pt-4"
              style={{
                height: "calc(100%)",
              }}
            >
              {authority ? (
                <DecentralizationGroups
                  authority={authority}
                  setAuthority={setAuthority}
                  groups={authority.data}
                />
              ) : (
                <Spinner />
              )}
            </Scrollbars>
            <Form
              dialog
              width="450px"
              slideFromBottom="none"
              defaultValues={openAuthorityDialog}
              isOpen={!!openAuthorityDialog}
              onClose={() => setOpenAuthorityDialog(null)}
              title={`${openAuthorityDialog?.id ? t("Chỉnh sửa") : t("Tạo")} `}
              onSubmit={(data) =>
                AuthorityService.createOrUpdate({
                  id: openAuthorityDialog?.id,
                  data,
                  toast,
                  fragment: AuthorityService.shortFragment,
                }).then(async (res) => {
                  await loadAuthorities();
                  setAuthorityId(res.id);
                  setOpenAuthorityDialog(null);
                })
              }
            >
              <Field label={t("Tên phân quyền")} name="name" required>
                <Input autoFocus />
              </Field>
              {!openAuthorityDialog?.id && (
                <>
                  <Field name="parentId" label={t("Thuộc phân quyền")} disabled={true}>
                    <Select
                      defaultValue={openAuthorityDialog?.parentId}
                      value={openAuthorityDialog?.parentId}
                      autocompletePromise={(props) =>
                        AuthorityService.getAllAutocompletePromise(props, {
                          fragment: "id name",
                          parseOption: (data) => ({
                            value: data.id,
                            label: data.name,
                          }),
                        })
                      }
                    />
                  </Field>
                  {/* <Field name="parentId" className="hidden">
                    <Input />
                  </Field> */}
                </>
              )}
              <Form.Footer
                submitProps={{
                  disabled: !userPermission("EDIT_AUTHORITY"),
                }}
              />
            </Form>
          </>
        ) : (
          <Spinner />
        )}
      </Card>
    </div>
  );
}

function DecentralizationGroups({
  authority,
  setAuthority,
  ...props
}: {
  authority: Authority;
  setAuthority: (authority) => any;
  groups: AuthorityGroup[];
}) {
  const [groups, setGroups] = useState<AuthorityGroup[]>();
  const toast = useToast();
  const { user, userPermission } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    setGroups(cloneDeep(props.groups));
  }, [props.groups]);

  if (!groups) return null;
  return (
    <Form
      className="min-w-lg"
      onReset={() => {
        setGroups(cloneDeep(props.groups));
      }}
      onSubmit={async () => {
        await AuthorityService.update({
          id: authority.id,
          data: {
            scopes: groups.reduce(
              (items, group) => [
                ...items,
                ...group.features.reduce(
                  (items, feature) => [
                    ...items,
                    ...feature.scopes.filter((x) => x.checked).map((x) => x.code),
                  ],
                  []
                ),
              ],
              []
            ),
          },
          toast,
        });
        // .then((res) => {
        //   toast.success(t("Cập nhật phân quyền thành công"));
        // })
        // .catch(() => {
        //   toast.error(t("Bạn không thể cập nhật / hoặc giao diện không cho phép cập nhật"));
        // });
      }}
    >
      {groups.map((group) => (
        <DecentralizationGroup
          key={group.code}
          group={group}
          onChange={() => {
            setGroups([...groups]);
          }}
        />
      ))}

      <Form.Footer
        className="sticky bottom-0 px-4 py-3 pt-3 bg-white border-t border-gray-200"
        cancelText=""
        submitProps={{
          disabled:
            authority?.root == true ||
            user.authority?.id == authority?.id ||
            (user.role != "ADMIN" && !authority?.parentIds.includes(user.authorityId)) ||
            !userPermission("EDIT_AUTHORITY"),
        }}
      />
    </Form>
  );
}

function DecentralizationGroup({
  onChange,
  group,
}: {
  onChange: () => any;
  group: AuthorityGroup;
}) {
  const { t } = useTranslation();
  const toggleGroup = (checked: boolean) => {
    group.features.forEach((feature) => {
      toggleFeature(feature, checked);
    });
    onChange();
  };

  const toggleFeature = (feature: AuthorityFeature, checked: boolean) => {
    if (!feature.readOnly) {
      feature.checked = checked;
      feature.scopes.forEach((item) => {
        if (!item.readOnly) item.checked = checked;
      });
      onChange();
    }
  };

  const toggleScope = (scope: AuthorityScope, checked: boolean) => {
    if (!scope.readOnly) {
      scope.checked = checked;
      onChange();
    }
  };

  if (!group) return null;
  return (
    <div className="px-4 mt-6">
      <div className="w-full border-b-4 border-accent">
        <div className="px-2 pt-1 pr-12 rounded-tl w-80 rounded-tr-2xl bg-accent">
          <Checkbox
            className="font-semibold min-h-9"
            theme="white"
            uncheckedIcon={<RiCheckboxBlankFill />}
            value={group.checked}
            placeholder={t(`${group.name}`)}
            name={group.name}
            readOnly={group.readOnly}
            onChange={(value) => {
              toggleGroup(value);
            }}
          />
        </div>
      </div>

      {group.features?.map((feature) => (
        <div key={feature.code} className={`flex py-3 px-1 border-b`}>
          <Checkbox
            className="flex-1 min-h-9"
            value={feature.checked}
            placeholder={t(`${feature.name}`)}
            name={feature.name}
            readOnly={feature.readOnly}
            onChange={(value) => {
              toggleFeature(feature, value);
            }}
          />
          <div className="flex flex-col flex-1">
            {feature.scopes?.map((scope, index) => {
              return (
                <Checkbox
                  className="min-h-9"
                  value={scope.checked}
                  key={scope.code}
                  placeholder={t(`${scope.name}`)}
                  readOnly={scope.readOnly}
                  onChange={(value) => toggleScope(scope, value)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface BranchProps {
  authority: Partial<Authority & { children: Authority[] }>;
  authorityId: string;
  isLast?: boolean;
  onClick?: (authority: Authority) => any;
  onCreateClick?: () => any;
  onUpdateClick?: () => any;
  onDeleteClick?: () => any;
}
function AuthorityBranch({
  authority,
  authorityId,
  isLast,
  onClick,
  onCreateClick,
  onUpdateClick,
  onDeleteClick,
}: BranchProps) {
  return (
    <>
      <div
        className={`relative ${authority.parentIds?.length ? "branch-item" : ""} ${
          isLast ? "is-last" : ""
        }`}
      >
        <div className="flex mb-0.5 relative">
          <Button
            primary={authority.id == authorityId}
            icon={authority.id == authorityId ? <HiKey /> : <HiOutlineKey />}
            className={`ml-1 h-7 pl-1.5 pr-3 text-sm ${
              authority.id == authorityId ? "z-10" : "hover:bg-primary-light hover:z-10"
            }`}
            text={authority.name}
            onClick={() => onClick(authority)}
          />
          {/* {authority.id == authorityId && (
            <div className="absolute z-10 ml-2 bg-white rounded border-group -top-8 left-16">
              <Button
                outline
                hoverSuccess
                text="Tạo"
                className="px-2 text-xs h-7"
                icon={<HiOutlinePlus />}
                onClick={onCreateClick}
                disabled={!userPermission("SAVE_DECENTRALIZATION")}
              />
              <Button
                outline
                hoverAccent
                text="Sửa"
                className="px-2 text-xs h-7"
                icon={<HiOutlinePencil />}
                onClick={onUpdateClick}
                disabled={authority?.name == "Admin" || !userPermission("SAVE_DECENTRALIZATION")}
              />
              <Button
                outline
                hoverDanger
                text="Xoá"
                className="px-2 text-xs h-7"
                icon={<HiOutlineTrash />}
                onClick={onDeleteClick}
                disabled={authority?.name == "Admin" || !userPermission("DELETE_DECENTRALIZATION")}
              />
            </div>
          )} */}
        </div>
        {!!authority.children?.length && (
          <div className={`pl-4 relative flex flex-col items-start branch-group`}>
            {authority.children?.map((child, index) => (
              <AuthorityBranch
                key={child.id}
                authorityId={authorityId}
                authority={child}
                isLast={index == authority.children.length - 1}
                onClick={(item) => {
                  onClick(item);
                }}
                onCreateClick={onCreateClick}
                onUpdateClick={onUpdateClick}
                onDeleteClick={onDeleteClick}
              />
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        .branch-item:not(.is-last)::before {
          position: absolute;
          content: "";
          top: -12px;
          left: -4px;
          width: 1px;
          height: calc(100% + 24px);
          border-left: 1px solid #ccc;
        }
        .branch-item.is-last::before {
          position: absolute;
          content: "";
          top: -8px;
          left: -4px;
          width: 1px;
          height: 20px;
          border-left: 1px solid #ccc;
        }
        .branch-item::after {
          position: absolute;
          content: "";
          top: 12px;
          left: -4px;
          width: 8px;
          height: 1px;
          border-top: 1px solid #ccc;
        }
      `}</style>
    </>
  );
}
