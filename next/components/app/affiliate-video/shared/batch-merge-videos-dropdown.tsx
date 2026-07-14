/**
 * batch-merge-videos-dropdown.tsx
 * Nút "Nối file" kèm Popover: Video thường | Video nối → ghép thành 1 MP4 (ffmpeg).
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowDownSLine, RiLinkM, RiLoader4Line } from "react-icons/ri";
import { Popover } from "../../../shared/utilities/popover/popover";

interface BatchMergeVideosDropdownProps {
  id?: string;
  merging: boolean;
  mergeLabel?: string;
  availableVideoCount: number;
  availableExtendCount: number;
  disabled?: boolean;
  onMergeNormal: () => void;
  onMergeStitch: () => void;
}

export function BatchMergeVideosDropdown({
  id = "batch-merge-videos",
  merging,
  mergeLabel = "",
  availableVideoCount,
  availableExtendCount,
  disabled = false,
  onMergeNormal,
  onMergeStitch,
}: BatchMergeVideosDropdownProps) {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const canMergeNormal = availableVideoCount >= 2;
  const canMergeStitch = availableExtendCount >= 2;
  const nothingToMerge = !canMergeNormal && !canMergeStitch;
  const isDisabled = disabled || merging || nothingToMerge;

  const menuItems = [
    {
      label: t("Video thường"),
      hint: t("Nối các video scene thành 1 file MP4"),
      disabled: !canMergeNormal || merging,
      action: onMergeNormal,
    },
    {
      label: t("Video nối"),
      hint: t("Nối các video nối (stitch) thành 1 file MP4"),
      disabled: !canMergeStitch || merging,
      action: onMergeStitch,
    },
  ];

  const handleSelect = (action: () => void) => {
    setOpen(false);
    action();
  };

  const buttonColor = merging ? "bg-orange-400 cursor-wait" : "bg-yellow-500 hover:bg-yellow-600";
  const buttonLabel = merging
    ? mergeLabel
      ? `${t("Đang nối")} ${mergeLabel}...`
      : t("Đang nối...")
    : t("Nối file");

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return;
          setOpen((prev) => !prev);
        }}
        className={`flex items-center whitespace-nowrap gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer border-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${buttonColor}`}
      >
        {merging ? <RiLoader4Line className="animate-spin" /> : <RiLinkM />}
        {buttonLabel}
        {!merging && <RiArrowDownSLine className="text-sm opacity-80" />}
      </button>

      <Popover
        reference={buttonRef}
        trigger="click"
        placement="bottom-start"
        arrow={false}
        maxWidth={280}
        visible={open}
        hideOnClickOutside
        zIndex={10050}
        onHidden={() => setOpen(false)}
        onClickOutside={() => setOpen(false)}
      >
        <div className="py-1 min-w-[240px]">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              className="px-3 py-2 w-full text-left transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              onClick={() => {
                if (item.disabled) return;
                handleSelect(item.action);
              }}
            >
              <div className="text-xs font-medium text-gray-800">{item.label}</div>
              <div className="mt-0.5 text-[11px] text-gray-400">{item.hint}</div>
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
