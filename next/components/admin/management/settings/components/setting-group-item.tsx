import Link from "next/link";
import { useRef } from "react";

import { useTranslation } from "react-i18next";
import { SettingGroup } from "../../../../../lib/repo/general/setting-group.repo";

interface PropTypes extends ReactProps {
  settingGroup: SettingGroup;
  onEdit: (settingGroup: SettingGroup) => any;
  onDelete: (settingGroup: SettingGroup) => any;
}
export function SettingGroupItem(props: PropTypes) {
  const { t } = useTranslation();
  const href = `/admin/management/settings/${encodeURIComponent(props.settingGroup.slug)}`;
  const isActive = location.pathname == href;
  const ref = useRef();

  return (
    <Link
      href={href}
      // data-tooltip={props.settingGroup.desc}
      // data-placement="right"
      className={`relative flex flex-col pl-4 pr-2 py-3 text-gray-600 group border-b border-gray-200`}
    >
      {isActive && <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary"></div>}
      <div className="flex items-center justify-between">
        <strong className={`group-hover:text-primary text-sm  ${isActive && "text-primary"}`}>
          {t(props.settingGroup.name)}
        </strong>
        {/* <div
          className="flex items-center h-8 pl-4 pr-1 text-gray-600 cursor-pointer hover:text-primary"
          ref={ref}
          onClick={(e) => e.preventDefault()}
        >
          <i className="text-2xl">
            <RiMore2Fill />
          </i>
        </div> */}
        {/* <Dropdown placement="right-start" reference={ref}>
          <Dropdown.Item text="Chỉnh sửa" onClick={() => props.onEdit(props.settingGroup)} />
          <Dropdown.Item
            hoverDanger
            text="Xoá"
            onClick={() => props.onDelete(props.settingGroup)}
          />
        </Dropdown> */}
      </div>
      {props.settingGroup.desc && (
        <div className="text-xs text-gray-500">{t(props.settingGroup.desc)}</div>
      )}
    </Link>
  );
}
