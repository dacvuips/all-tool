import copy from "copy-to-clipboard";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck } from "react-icons/hi";
import { RiFileCopy2Line } from "react-icons/ri";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Button } from "../form";

// ===== Types =====
export interface CodeSample {
  /** Label for the tab */
  label: string;
  /** Language identifier for display */
  lang: string;
  /** Short icon text (e.g. "PHP", "JS", ">_") */
  icon: string;
  /** Tailwind classes for icon background (e.g. "bg-indigo-500 text-white") */
  iconBg: string;
  /** The code snippet string */
  code: string;
}

// ===== Simple Syntax Highlighting =====
export const SyntaxLine = memo(({ line }: { line: string }) => {
  const colorize = (text: string) => {
    if (text.trimStart().startsWith("//") || text.trimStart().startsWith("#")) {
      return <span className="text-gray-500 italic">{text}</span>;
    }
    if (text.includes("<?php")) {
      return <span className="text-red-400">{text}</span>;
    }
    if (text.trim() === "") {
      return <span>&nbsp;</span>;
    }

    const parts: JSX.Element[] = [];
    const keywords =
      /\b(const|let|var|function|async|await|try|catch|throw|return|if|else|new|require|use|echo|true|false|null|require_once|curl|jq)\b/g;
    const stringRegex = /('[^']*'|"[^"]*"|`[^`]*`)/g;

    const stringParts = text.split(stringRegex);
    stringParts.forEach((part, pi) => {
      if (
        (part.startsWith("'") && part.endsWith("'")) ||
        (part.startsWith('"') && part.endsWith('"')) ||
        (part.startsWith("`") && part.endsWith("`"))
      ) {
        parts.push(
          <span key={pi} className="text-green-400">
            {part}
          </span>
        );
      } else {
        const kwParts = part.split(keywords);
        const kwSet = new Set([
          "const",
          "let",
          "var",
          "function",
          "async",
          "await",
          "try",
          "catch",
          "throw",
          "return",
          "if",
          "else",
          "new",
          "require",
          "use",
          "echo",
          "true",
          "false",
          "null",
          "require_once",
          "curl",
          "jq",
        ]);
        kwParts.forEach((kp, ki) => {
          if (kwSet.has(kp)) {
            parts.push(
              <span key={`${pi}-${ki}`} className="text-blue-600 font-semibold">
                {kp}
              </span>
            );
          } else {
            const varParts = kp.split(/(\$\w+)/g);
            varParts.forEach((vp, vi) => {
              if (vp.startsWith("$")) {
                parts.push(
                  <span key={`${pi}-${ki}-${vi}`} className="text-sky-400">
                    {vp}
                  </span>
                );
              } else {
                const fnParts = vp.split(/(->|=>|\w+\()/g);
                fnParts.forEach((fp, fi) => {
                  if (fp === "->" || fp === "=>") {
                    parts.push(
                      <span key={`${pi}-${ki}-${vi}-${fi}`} className="text-yellow-300">
                        {fp}
                      </span>
                    );
                  } else if (fp.endsWith("(")) {
                    parts.push(
                      <span key={`${pi}-${ki}-${vi}-${fi}`} className="text-green-400">
                        {fp}
                      </span>
                    );
                  } else {
                    parts.push(
                      <span key={`${pi}-${ki}-${vi}-${fi}`} className="text-gray-700">
                        {fp}
                      </span>
                    );
                  }
                });
              }
            });
          }
        });
      }
    });

    return <span>{parts}</span>;
  };

  return <span className="whitespace-pre">{colorize(line)}</span>;
});
SyntaxLine.displayName = "SyntaxLine";

// ===== Code Block with Line Numbers =====
export const CodeBlock = ({ codeSample, title }: { codeSample: CodeSample[]; title: string }) => {
  const toast = useToast();

  const { t } = useTranslation();
  const [codeCopied, setCodeCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(codeSample[0]?.label || "");

  const activeSample = codeSample.find((s) => s.label === activeTab) || codeSample[0];
  const lines = activeSample?.code.split("\n") || [];

  const handleCopyCode = useCallback(() => {
    if (activeSample?.code) {
      copy(activeSample.code);
      setCodeCopied(true);
      toast.success(t("Đã sao chép mã nguồn"));
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }, [activeSample, t, toast]);

  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {title}
        </label>
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Tabs */}
          <div className="flex items-center bg-gray-50 border-b gap-1 p-1 border-gray-100 overflow-x-auto no-scrollbar ">
            {codeSample.map((tab) => {
              const isActive = activeTab === tab.label;

              return (
                <Button
                  key={tab.label}
                  onClick={() => setActiveTab(tab.label)}
                  className={`flex items-center  border whitespace-nowrap rounded-md gap-1.5 py-2 h-7 px-1 text-8 font-semibold transition-all duration-150 ${
                    isActive
                      ? "border-primary  text-primary bg-white"
                      : "text-gray-400 hover:text-gray-200 "
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded text-4 font-bold ${tab.iconBg}`}
                  >
                    {tab.icon}
                  </span>
                  <span className="text-12">{tab.label}</span>
                </Button>
              );
            })}
            {/* Spacer + copy icon on the right */}
            <div className="flex-1" />
            <button
              onClick={handleCopyCode}
              className="mr-2 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title={t("Sao chép mã nguồn")}
            >
              {codeCopied ? (
                <HiCheck className="text-sm text-emerald-400" />
              ) : (
                <RiFileCopy2Line className="text-sm" />
              )}
            </button>
          </div>

          {/* Code Content */}
          <div className="relative">
            <div className="overflow-x-auto rounded-b-lg   text-sm font-mono py-3">
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="select-none text-right pr-4 pl-4 py-0 text-gray-500 text-xs w-8 align-top leading-6">
                        {i + 1}
                      </td>
                      <td className="pr-4 py-0 leading-6">
                        <SyntaxLine line={line} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeBlock;
