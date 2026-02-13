import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../../../shared/utilities/form";
import { MoveIcon, TrashIcon, XMarkIcon } from "./icons";
import { ClassificationGroup, ClassificationOption } from "./types";

interface Props {
  groups: ClassificationGroup[];
  setGroups: React.Dispatch<React.SetStateAction<ClassificationGroup[]>>;
}
interface OptionRowProps {
  group: ClassificationGroup;
  option: ClassificationOption;
  index: number;
  updateOptionName: (groupId: string, optionId: string, name: string) => void;
  removeOption: (groupId: string, optionId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: () => void;
}

// Sub-component to handle individual option row logic (especially drag handle)
const OptionRow: React.FC<OptionRowProps> = ({
  group,
  option,
  index,
  updateOptionName,
  removeOption,
  onDragStart,
  onDragEnter,
  onDragEnd,
}) => {
  const [isDraggable, setIsDraggable] = useState(false);

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnter={(e) => onDragEnter(e, index)}
      onDragEnd={(e) => {
        setIsDraggable(false);
        onDragEnd();
      }}
      onDragOver={(e) => e.preventDefault()}
      className={`flex items-center gap-2 group/option ${isDraggable ? "opacity-50" : ""}`}
    >
      <div className="relative">
        <input
          type="text"
          value={option.name}
          onChange={(e) => updateOptionName(group.code, option.code, e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-32 focus:border-red-500 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // If input has value, focus the "Add Option" input (the em pty one at the end)
              if (option.name.trim()) {
                const addInput = document.getElementById(`add-option-input-${group.code}`);
                if (addInput) {
                  addInput.focus();
                }
              }
            }
          }}
        />
      </div>
      <div
        className="flex text-gray-300 cursor-grab active:cursor-grabbing hover:text-gray-500 drag-handle"
        onMouseDown={() => setIsDraggable(true)}
        onMouseUp={() => setIsDraggable(false)}
        onMouseLeave={() => setIsDraggable(false)}
      >
        <MoveIcon />
      </div>
      <button
        type="button"
        onClick={() => removeOption(group.code, option.code)}
        className="text-gray-400 transition-colors hover:text-red-500"
      >
        <TrashIcon />
      </button>
    </div>
  );
};

export const ClassificationSection: React.FC<Props> = ({ groups, setGroups }) => {
  const { t } = useTranslation();

  const dragItem = useRef<{ groupId: string; index: number } | null>(null);

  const addGroup = () => {
    if (groups.length >= 2) return;
    const newGroup: ClassificationGroup = {
      code: crypto.randomUUID(),
      name: "", // default hints
      options: [],
    };
    setGroups([...groups, newGroup]);
  };

  const removeGroup = (groupId: string) => {
    setGroups(groups.filter((g) => g.code !== groupId));
  };

  const updateGroupName = (groupId: string, name: string) => {
    setGroups(groups.map((g) => (g.code === groupId ? { ...g, name } : g)));
  };

  const addOption = (groupId: string, optionName: string) => {
    if (!optionName.trim()) return;
    setGroups(
      groups.map((g) => {
        if (g.code === groupId) {
          // Check for duplicate names
          if (
            g.options.some((o) => o.name.trim().toLowerCase() === optionName.trim().toLowerCase())
          ) {
            return g;
          }
          return {
            ...g,
            options: [...g.options, { code: crypto.randomUUID(), name: optionName.trim() }],
          };
        }
        return g;
      })
    );
  };

  const removeOption = (groupId: string, optionId: string) => {
    setGroups(
      groups.map((g) => {
        if (g.code === groupId) {
          return { ...g, options: g.options.filter((o) => o.code !== optionId) };
        }
        return g;
      })
    );
  };

  const updateOptionName = (groupId: string, optionId: string, name: string) => {
    setGroups(
      groups.map((g) => {
        if (g.code === groupId) {
          return {
            ...g,
            options: g.options.map((o) => (o.code === optionId ? { ...o, name } : o)),
          };
        }
        return g;
      })
    );
  };

  // Helper for input Enter key
  const handleOptionInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, groupId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addOption(groupId, e.currentTarget.value);
      e.currentTarget.value = "";
    }
  };

  // Drag and Drop Handlers
  const onDragStart = (e: React.DragEvent, groupId: string, index: number) => {
    dragItem.current = { groupId, index };
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnter = (e: React.DragEvent, groupId: string, index: number) => {
    if (!dragItem.current) return;
    if (dragItem.current.groupId !== groupId) return;
    if (dragItem.current.index === index) return;

    const newGroups = [...groups];
    const groupIndex = newGroups.findIndex((g) => g.code === groupId);
    const group = newGroups[groupIndex];
    const newOptions = [...group.options];

    const draggedItemContent = newOptions[dragItem.current.index];
    newOptions.splice(dragItem.current.index, 1);
    newOptions.splice(index, 0, draggedItemContent);

    newGroups[groupIndex] = { ...group, options: newOptions };

    dragItem.current.index = index;
    setGroups(newGroups);
  };

  const onDragEnd = () => {
    dragItem.current = null;
  };

  return (
    <>
      <div className="flex flex-col col-span-12 gap-6">
        <div className="flex gap-8">
          <div className="flex flex-col flex-1 gap-4">
            {groups.map((group, index) => (
              <div
                key={group.code}
                className="relative p-4 bg-gray-50 rounded border border-gray-300 border-dashed group"
              >
                {/* Remove Group Button */}
                <button
                  type="button"
                  onClick={() => removeGroup(group.code)}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>

                {/* Group Name Input */}
                <div className="flex items-center mb-4">
                  <label className="w-32 text-sm text-gray-500">
                    {t("Nhóm phân loại")} {index + 1}
                  </label>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateGroupName(group.code, e.target.value)}
                    className="flex-1 max-w-sm border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                    placeholder={index === 0 ? t("ví dụ: màu sắc") : t("ví dụ: kích thước")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        // Move focus to the "Add option" input for better UX
                        const optionInput = document.getElementById(
                          `add-option-input-${group.code}`
                        );
                        if (optionInput) {
                          optionInput.focus();
                        }
                      }
                    }}
                  />
                </div>

                {/* Options List */}
                <div className="flex items-start">
                  <label className="pt-2 w-32 text-sm text-gray-500">{t("Phân loại hàng")}</label>
                  <div className="flex flex-wrap flex-1 gap-3 items-center">
                    {group.options.map((option, optIndex) => (
                      <OptionRow
                        key={option.code}
                        group={group}
                        option={option}
                        index={optIndex}
                        updateOptionName={updateOptionName}
                        removeOption={removeOption}
                        onDragStart={(e, i) => onDragStart(e, group.code, i)}
                        onDragEnter={(e, i) => onDragEnter(e, group.code, i)}
                        onDragEnd={onDragEnd}
                      />
                    ))}

                    {/* Add New Option Input */}
                    <div className="flex items-center w-48">
                      <input
                        type="text"
                        onKeyDown={(e) => handleOptionInputKeyDown(e, group.code)}
                        onBlur={(e) => {
                          if (e.target.value) {
                            addOption(group.code, e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder={
                          index === 0 ? t("ví dụ: Trắng, Đỏ v.v") : t("ví dụ: L, M, XL, XX")
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {groups.length < 2 && (
              <Button
                onClick={addGroup}
                className="flex gap-2 items-center self-start px-4 py-2 text-sm font-medium text-red-500 rounded border border-red-500 border-dashed transition-colors hover:bg-red-50"
              >
                <span className="text-lg leading-none">+</span> {t("Thêm nhóm phân loại")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
