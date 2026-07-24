import copy from "copy-to-clipboard";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck, HiKey, HiLockClosed } from "react-icons/hi";
import { RiFileCopy2Line, RiStackLine } from "react-icons/ri";
import { TbGauge } from "react-icons/tb";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { buildApiMediaRequestBody } from "../../../../api-media/api-media-guide-config";
import {
  buildCreateJobSnippet,
  buildPollJobSnippet,
  buildUpsampleImageSnippet,
  buildUpsampleVideoSnippet,
  getApiBaseUrl,
} from "../../../../api-media/api-media-guide-snippets";
import {
  API_MEDIA_CONSOLE_MODELS,
  API_MEDIA_ROUTES,
  ApiMediaRouteId,
  CONSOLE_STATS,
  ConsoleCodeLang,
  ROUTE_CONFIG,
} from "./home-api-media-console-config";

const PLACEHOLDER_API_KEY = "YOUR_API_KEY";

const CODE_SYNTAX = {
  bg: "#0d1117",
  keyword: "#0081f3",
  string: "#7700f7",
  constant: "#ffa657",
  comment: "#8b949e",
  default: "#000",
} as const;

const CODE_KEYWORDS = new Set([
  "import",
  "from",
  "const",
  "await",
  "new",
  "return",
  "async",
  "function",
  "let",
  "var",
  "def",
  "while",
  "break",
  "print",
  "time",
  "curl",
  "requests",
  "json",
  "True",
  "False",
  "None",
]);

function highlightLine(line: string): React.ReactNode {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return <span style={{ color: CODE_SYNTAX.comment, fontStyle: "italic" }}>{line}</span>;
  }

  const parts: React.ReactNode[] = [];
  const regex =
    /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b[A-Z][A-Z0-9_]*\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*)(?=\s*:)|(\b[a-zA-Z_][a-zA-Z0-9_]*\b)/g;

  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(
        <span key={key++} style={{ color: CODE_SYNTAX.default }}>
          {line.slice(last, match.index)}
        </span>
      );
    }

    const token = match[0];
    if (match[1]) {
      parts.push(
        <span key={key++} style={{ color: CODE_SYNTAX.string }}>
          {token}
        </span>
      );
    } else if (match[2]) {
      parts.push(
        <span key={key++} style={{ color: CODE_SYNTAX.constant }}>
          {token}
        </span>
      );
    } else if (match[3]) {
      parts.push(
        <span key={key++} style={{ color: CODE_SYNTAX.keyword }}>
          {token}
        </span>
      );
    } else if (match[4]) {
      const color = CODE_KEYWORDS.has(token) ? CODE_SYNTAX.keyword : CODE_SYNTAX.default;
      parts.push(
        <span key={key++} style={{ color }}>
          {token}
        </span>
      );
    }

    last = match.index + token.length;
  }

  if (last < line.length) {
    parts.push(
      <span key={key++} style={{ color: CODE_SYNTAX.default }}>
        {line.slice(last)}
      </span>
    );
  }

  return parts.length ? parts : <span style={{ color: CODE_SYNTAX.default }}>{line}</span>;
}

function SyntaxCode({ code }: { code: string }) {
  return (
    <pre
      className="overflow-auto flex-1 p-4 m-0 font-mono whitespace-pre bg-gray-50 text-11 sm:text-xs"
      style={{ lineHeight: 1.65 }}
    >
      {code.split("\n").map((line, i) => (
        <div key={i}>{highlightLine(line)}</div>
      ))}
    </pre>
  );
}

function buildNodeSnippet(routeId: ApiMediaRouteId): string {
  const base = getApiBaseUrl();

  if (routeId === "poll_job") {
    return `const jobId = "JOB_ID_FROM_CREATE_RESPONSE";

const res = await fetch(\`${base}/api/api-media/job/\${jobId}\`, {
  headers: { "x-api-key": API_MEDIA_KEY },
});
const { data } = await res.json();
console.log(data.status, data.progress);

// Same gateway — poll until SUCCEEDED or FAILED`;
  }

  if (routeId === "upsample_image") {
    return `const enqueue = await fetch("${base}/api/api-media/upsample-image", {
  method: "POST",
  headers: {
    "x-api-key": API_MEDIA_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    resolution: "4K",
    flow2RequestId: "FLOW2_REQUEST_ID_FROM_JOB_RESULT",
  }),
});
const { jobId } = await enqueue.json();

// Poll GET /api/api-media/job/:jobId → resultData.imageUrl`;
  }

  if (routeId === "upsample_video") {
    return `const enqueue = await fetch("${base}/api/api-media/upsample-video", {
  method: "POST",
  headers: {
    "x-api-key": API_MEDIA_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    requestId: "FLOW2_REQUEST_ID_FROM_JOB_RESULT",
  }),
});
const { jobId } = await enqueue.json();

// Poll GET /api/api-media/job/:jobId → resultData.videoUri`;
  }

  const config = ROUTE_CONFIG[routeId];
  const action = config.creationType === "image" ? "IMAGE_GENERATION" : "VIDEO_GENERATION";
  const body = buildApiMediaRequestBody(config);
  const model = config.creationType === "image" ? config.imageModel : config.videoQuality;
  const bodyJson = JSON.stringify(body, null, 2).replace(/\n/g, "\n  ");

  return `const res = await fetch("${base}/api/api-media?type=${action}", {
  method: "POST",
  headers: {
    "x-api-key": API_MEDIA_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${bodyJson}),
});
const { jobId, status } = await res.json();
console.log(jobId, status);

// model: ${model} — async job + poll`;
}

function getRouteCode(routeId: ApiMediaRouteId, lang: ConsoleCodeLang): string {
  const config = ROUTE_CONFIG[routeId];

  if (lang === "node") {
    return buildNodeSnippet(routeId);
  }
  if (routeId === "poll_job") {
    return buildPollJobSnippet(PLACEHOLDER_API_KEY, lang);
  }
  if (routeId === "upsample_image") {
    return buildUpsampleImageSnippet(PLACEHOLDER_API_KEY, config, lang);
  }
  if (routeId === "upsample_video") {
    return buildUpsampleVideoSnippet(PLACEHOLDER_API_KEY, lang);
  }
  return buildCreateJobSnippet(PLACEHOLDER_API_KEY, config, lang);
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-primary bg-primary-light bg-opacity-20">
      <div className="flex flex-shrink-0 justify-center items-center w-9 h-9 rounded-lg text-primary bg-primary-light">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold truncate text-primary text-11">{label}</p>
        <p className="text-gray-500 truncate text-11">{value}</p>
      </div>
    </div>
  );
}

export function HomeApiMediaConsole() {
  const { t } = useTranslation();
  const toast = useToast();
  const [activeRoute, setActiveRoute] = useState<ApiMediaRouteId>("create_image");
  const [lang, setLang] = useState<ConsoleCodeLang>("node");
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => getRouteCode(activeRoute, lang), [activeRoute, lang]);

  const handleCopy = useCallback(() => {
    copy(code);
    setCopied(true);
    toast.success(t("Đã sao chép mã nguồn"));
    setTimeout(() => setCopied(false), 2000);
  }, [code, t, toast]);

  const statIcons = {
    models: <RiStackLine className="text-lg" />,
    speed: <TbGauge className="text-lg" />,
    free: <HiKey className="text-lg" />,
    access: <HiLockClosed className="text-lg" />,
  };

  return (
    <section className="px-4 py-12 bg-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden bg-white rounded-2xl border border-dashed border-primary">
          <div className="grid grid-cols-2 gap-3 p-4 border-b border-gray-100 lg:grid-cols-4">
            {CONSOLE_STATS.map((stat) => (
              <StatCard
                key={stat.id}
                icon={statIcons[stat.id]}
                label={stat.label}
                value={stat.value}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 items-center px-4 py-2.5 border-b border-gray-200 bg-gray-100">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <div className="flex gap-2 justify-center items-center text-sm font-medium text-slate-300">
              <span className="font-bold text-primary">API Media console</span>
            </div>
            <div className="flex justify-end">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-11 font-semibold rounded-full border text-success-dark bg-success-light">
                <HiCheck className="text-xs" />
                Live
              </span>
            </div>
          </div>

          <div className="flex flex-col w-full min-h-[440px] lg:flex-row">
            <div className="flex flex-col flex-shrink-0 w-full border-b border-gray-100 lg:w-1/4 lg:border-b-0 lg:border-r">
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-xs font-medium text-slate-400">Routes</span>
                <span className="text-xs text-slate-600">{API_MEDIA_ROUTES.length}</span>
              </div>

              <div className="flex-1 px-2 pb-2 space-y-0.5">
                {API_MEDIA_ROUTES.map((route) => {
                  const active = activeRoute === route.id;
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setActiveRoute(route.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg font-mono text-11 leading-snug transition-colors sm:text-xs ${
                        active
                          ? "font-bold bg-gray-100 bg-opacity-50 ring-1 text-primary ring-primary"
                          : "text-slate-400 hover:bg-gray-100 hover:text-slate-300"
                      }`}
                    >
                      <span
                        className={
                          route.method === "GET"
                            ? "text-success-dark font-bold"
                            : "text-primary font-bold"
                        }
                      >
                        {route.method}
                      </span>{" "}
                      {route.path}
                    </button>
                  );
                })}
              </div>

              <div className="p-3 mx-2 mb-3 bg-opacity-50 rounded-xl border bg-primary-light border-primary">
                <div className="flex gap-2 items-center mb-1">
                  <HiLockClosed className="text-xs text-slate-500" />
                  <span className="text-xs font-medium text-slate-300">Guardrail</span>
                </div>
                <p className="text-[11px] text-slate-500">Plan, model, quota, RPM</p>
                <Link
                  href="/api-generate-media"
                  className="inline-block mt-2 font-medium text-primary text-11 hover:text-blue-300"
                >
                  {t("Lấy API Key")} →
                </Link>
              </div>
            </div>

            <div className="flex flex-col flex-1 min-w-0 border-b border-gray-200 lg:border-b-0 lg:border-r">
              <div className="flex justify-between items-center px-3 py-2 border-b border-gray-200">
                <div className="flex gap-0.5">
                  {(["node", "curl", "python"] as ConsoleCodeLang[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setLang(tab)}
                      className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                        lang === tab
                          ? "bg-primary-light bg-opacity-50 text-primary"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  title={t("Copy")}
                  className="inline-flex justify-center items-center w-7 h-7 rounded-md transition-colors text-slate-400 hover:bg-gray-100 hover:text-slate-200"
                >
                  {copied ? (
                    <HiCheck className="text-sm text-success-dark" />
                  ) : (
                    <RiFileCopy2Line className="text-sm" />
                  )}
                </button>
              </div>
              <SyntaxCode code={code} />
            </div>

            <div className="flex flex-col flex-shrink-0 w-full lg:w-1/4">
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-xs font-medium text-slate-400">Models</span>
                <span className="text-xs text-emerald-400">Ready</span>
              </div>

              <div className="flex-1 px-2 pb-3 space-y-0.5 overflow-auto divide-y divide-gray-200">
                {API_MEDIA_CONSOLE_MODELS.map((model) => (
                  <div
                    key={`${model.kind}-${model.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-primary text-12">{model.label}</p>
                      <p className="text-gray-500 truncate text-12">{model.meta}</p>
                    </div>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 text-10 font-semibold rounded-full border ${
                        model.ready
                          ? "text-success-dark border-success-dark bg-success-light"
                          : "text-slate-600 border-gray-200 bg-gray-100"
                      }`}
                    >
                      {model.ready ? "Ready" : "Soon"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
