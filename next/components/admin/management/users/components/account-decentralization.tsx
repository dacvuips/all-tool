import { cloneDeep } from "lodash-es";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RiCheckboxBlankFill } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { User, UserService } from "../../../../../lib/repo/";
import {
  Authority,
  AuthorityFeature,
  AuthorityGroup,
  AuthorityScope,
  AuthorityService,
} from "../../../../../lib/repo/authority/authority.repo";
import { Button, Checkbox, Field, Form, Label, Select } from "../../../../shared/utilities/form";
import { Spinner } from "../../../../shared/utilities/misc";

interface Props extends ReactProps {
  userDecentrali: User;
  setUser: (userDecentrali: User) => any;
}
export function AccountDecentralization({ userDecentrali, setUser }: Props) {
  return (
    <>
      <Form defaultValues={userDecentrali}>
        <DecentralizationForm userDecentrali={userDecentrali} setUser={setUser} />
      </Form>
    </>
  );
}
function DecentralizationForm({ userDecentrali, setUser }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const { register, setValue, watch, getValues } = useFormContext();
  const [authority, setAuthority] = useState<Authority>();
  const authorityId = watch("authorityId");
  const { user, userPermission } = useAuth();
  register("scopes");
  register("authorityId");
  useEffect(() => {
    if (authorityId) {
      AuthorityService.getOne({ id: authorityId, toast }).then((res) => {
        const scopesUser: string[] = getValues("scopes");
        const scopesAuthorityChoose: string[] = res.scopes;
        const authority = cloneDeep(res);

        if (scopesUser) {
          authority.data.forEach((group) => {
            group.features.forEach((feature) => {
              feature.scopes.forEach((scope) => {
                // lựa chọn lấy scopes của user hoặc scopes của phân quyền

                if (
                  userDecentrali.authorityIds?.length > 0 &&
                  userDecentrali.authorityId === res.id
                ) {
                  scope.checked = userDecentrali.scopes.includes(scope.code);
                } else {
                  scope.checked = scopesAuthorityChoose.includes(scope.code);
                }
                // scope.checked =
                //   userDecentrali.authorityIds[0] == res.id
                //     ? userDecentrali.scopes.includes(scope.code)
                //     : scopesAuthorityChoose.includes(scope.code);
                // Nếu là không phải ADMIN thì không được chọn những checked bị false

                if (userDecentrali.id == user.id) {
                  return (scope.readOnly = true);
                } else if (!res.scopes.includes(scope.code)) {
                  return (scope.readOnly = true);
                } else {
                  scope.readOnly = false;
                }
              });
              feature.checked = feature.scopes.every((scope) => scope.checked);
              feature.checked == false ? (feature.readOnly = true) : (feature.readOnly = false);
              if (userDecentrali.id == user.id) {
                feature.readOnly = true;
              } else if (user.role == "ADMIN") {
                feature.readOnly = false;
              } else {
                return feature.checked == false || userDecentrali.role === "ADMIN"
                  ? (feature.readOnly = true)
                  : (feature.readOnly = false);
              }
            });

            group.checked = group.features.every((feature) => feature.checked);
          });
        }

        setAuthority(authority);
      });
    }
  }, [authorityId]);
  // useEffect(() => {
  //   if (authorityIds?.length) {
  //     setValue("authorityId", authorityIds[0]);
  //   }
  // }, [authorityIds]);

  return (
    <>
      <Field name="authorityId" label={t("Chọn phân quyền")} className="w-44">
        <Select
          optionsPromise={() =>
            AuthorityService.getAuthoritySelect().then((res) => {
              return res.map((item) => ({
                value: item._id,
                label: item.name,
              }));
            })
          }
          value={userDecentrali.authorityIds[0]}
          readOnly={
            user.id == router.query["id"] ||
            !userPermission("EDIT_USER") ||
            userDecentrali.role === "ADMIN"
          }
          onChange={(val) => {
            setLoading(true);
            setValue("authorityId", val);
          }}
        />
      </Field>

      {loading && !authority ? (
        <Spinner />
      ) : (
        <DecentralizationGroups
          userId={userDecentrali.id}
          setUser={setUser}
          groups={authority?.data}
          authorityId={authority?.id}
        />
      )}
    </>
  );
}

function DecentralizationGroups({
  userId,
  setUser,
  authorityId,
  ...props
}: {
  userId: string;
  setUser: (userId) => any;
  groups: AuthorityGroup[];
  authorityId: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [groups, setGroups] = useState<AuthorityGroup[]>();
  const { user, userPermission } = useAuth();
  const toast = useToast();
  const onClose = () => router.replace({ pathname: location.pathname, query: {} });
  useEffect(() => {
    setGroups(cloneDeep(props.groups));
  }, [props.groups]);

  if (!groups) return null;
  const HandleSubmit = async () => {
    await UserService.update({
      id: userId,
      data: {
        authorityId,
        scopes: groups.reduce(
          (items, group) => [
            ...items,
            ...group.features.reduce(
              (items, feature) => [
                ...items,
                ...feature.scopes.filter((x) => x.checked)?.map((x) => x.code),
              ],
              []
            ),
          ],
          []
        ),
      },
      toast,
    })
      .then((res) => {
        // setUser(res);
        // toast.success(t("Cập nhật phân quyền thành công"));
        onClose();
      })
      .catch((err) => {
        toast.error(`${t("Cập nhật phân quyền thất bại")}, ${err}`);
      });
  };
  return (
    <>
      <Form
        onReset={() => {
          setGroups(cloneDeep(props.groups));
        }}
      >
        <Label text={t("Tính năng phân quyền")} className="mb-2" />

        {groups?.map((group, index) => (
          <DecentralizationGroup
            key={index}
            group={group}
            onChange={() => {
              setGroups([...groups]);
            }}
          />
        ))}

        <div className="w-full text-right lg:pb-0 pb-14">
          <Button
            disabled={user.id == router.query["id"] || !userPermission("EDIT_USER")}
            primary
            onClick={() => HandleSubmit()}
            text={t("Lưu thay đổi")}
          />
        </div>
      </Form>
    </>
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
  const { userPermission } = useAuth();
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
    <div className="mb-6">
      <div className="w-full border-b-4 border-accent">
        <div className="w-64 px-2 pt-1 pr-12 rounded-tl rounded-tr-2xl bg-accent">
          <Checkbox
            className="font-semibold h-9"
            theme="white"
            uncheckedIcon={<RiCheckboxBlankFill />}
            value={group.checked}
            placeholder={t(`${group.name}`)}
            name={group.name}
            readOnly={group.readOnly || !userPermission("EDIT_USER")}
            onChange={(value) => {
              toggleGroup(value);
            }}
          />
        </div>
      </div>

      {group.features?.map((feature, index) => (
        <div key={index} className={`flex py-3 px-1 border-b`}>
          <Checkbox
            className="flex-1 h-9"
            value={feature.checked}
            placeholder={t(`${feature.name}`)}
            name={feature.name}
            readOnly={feature.readOnly || !userPermission("EDIT_USER")}
            onChange={(value) => {
              toggleFeature(feature, value);
            }}
          />
          <div className="flex flex-col flex-1">
            {feature.scopes?.map((scope, index) => {
              return (
                <Checkbox
                  className="h-9"
                  value={scope.checked}
                  key={index}
                  placeholder={t(`${scope.name}`)}
                  readOnly={scope.readOnly || !userPermission("EDIT_USER")}
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
