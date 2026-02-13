import { cloneDeep } from "lodash";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RiCheckboxBlankFill } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { AuthorityFeature, AuthorityGroup, AuthorityScope } from "../../../../../lib/repo";
import { Checkbox, Form, Label } from "../../../../shared/utilities/form";
export function ProfileUserAuthorityDetail({ ...props }) {
  const { user } = useAuth();

  return (
    <Form>
      <DecentralizationGroups groups={user.authority?.data} />
    </Form>
  );
}

function DecentralizationGroups({ ...props }: { groups: AuthorityGroup[] }) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<AuthorityGroup[]>();
  const { setValue } = useFormContext();

  useEffect(() => {
    setGroups(cloneDeep(props.groups));
  }, [props.groups]);
  useEffect(() => {
    if (groups) {
      setValue(
        "scopes",
        groups.reduce(
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
        )
      );
    }
  }, [groups]);

  if (!groups) return null;
  return (
    <div className="min-w-xs">
      <Label text={t("Quyền của bạn")} className="mb-2" />

      {groups.map((group) => {
        if (group.checked) {
          return (
            <DecentralizationGroup
              key={group.name}
              group={group}
              onChange={() => {
                setGroups([...groups]);
              }}
            />
          );
        }
      })}
    </div>
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
        <div className="px-2 pt-1 pr-12 rounded-tl w-80 rounded-tr-2xl bg-accent">
          <Checkbox
            className="font-semibold"
            theme="white"
            uncheckedIcon={<RiCheckboxBlankFill />}
            value={group.checked}
            placeholder={t(`${group.name}`)}
            name={group.name}
            readOnly={group.readOnly || !userPermission("SAVE_USER")}
            // onChange={(value) => {
            //   toggleGroup(value);
            // }}
          />
        </div>
      </div>

      {group.features?.map((feature, index) => {
        if (feature.checked) {
          return (
            <div key={index + feature.name} className={`flex py-3 px-1 border-b`}>
              <Checkbox
                className="flex-1 "
                value={feature.checked}
                placeholder={t(`${feature.name}`)}
                name={feature.name}

                // onChange={(value) => {
                //   toggleFeature(feature, value);
                // }}
              />
              <div className="flex flex-col flex-1">
                {feature.scopes?.map((scope, index) => {
                  if (scope.checked) {
                    return (
                      <Checkbox
                        className=""
                        value={scope.checked}
                        key={index}
                        placeholder={t(`${scope.name}`)}

                        // onChange={(value) => toggleScope(scope, value)}
                      />
                    );
                  }
                })}
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}
