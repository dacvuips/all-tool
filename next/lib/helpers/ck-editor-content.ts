import cheerio from "cheerio";
import DOMPurify from "dompurify";

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

const CK_SANITIZE_OPTIONS = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: ["referrerpolicy", "allow", "allowfullscreen", "frameborder", "src", "style", "title"],
};

export function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

function toYoutubeEmbedUrl(url: string): string | null {
  const id = extractYoutubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function buildYoutubeIframe(embedUrl: string): string {
  return (
    `<div class="ck-media__wrapper" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;">` +
    `<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" ` +
    `src="${embedUrl}" title="YouTube video" frameborder="0" ` +
    `referrerpolicy="strict-origin-when-cross-origin" allow="${IFRAME_ALLOW}" allowfullscreen></iframe></div>`
  );
}

/** Chuẩn hóa HTML từ CKEditor: chuyển oembed → iframe và thêm referrerpolicy cho YouTube. */
export function prepareCkEditorContent(html: string): string {
  if (!html) return "";

  const $ = cheerio.load(`<div id="ck-root">${html}</div>`, { decodeEntities: false }, false);
  const root = $("#ck-root");

  root.find("figure.media oembed").each((_, el) => {
    const url = $(el).attr("url") || "";
    const embedUrl = toYoutubeEmbedUrl(url);
    if (!embedUrl) return;
    $(el).replaceWith(buildYoutubeIframe(embedUrl));
  });

  root.find("[data-oembed-url]").each((_, el) => {
    const url = $(el).attr("data-oembed-url") || "";
    const embedUrl = toYoutubeEmbedUrl(url);
    if (!embedUrl) return;
    const figure = $(el).closest("figure.media");
    if (figure.length) {
      figure.html(buildYoutubeIframe(embedUrl));
    }
  });

  root.find("iframe").each((_, el) => {
    const $iframe = $(el);
    const src = $iframe.attr("src") || "";
    if (!/youtube\.com|youtube-nocookie\.com|youtu\.be/.test(src)) return;

    $iframe.attr("referrerpolicy", "strict-origin-when-cross-origin");
    if (!$iframe.attr("allow")) {
      $iframe.attr("allow", IFRAME_ALLOW);
    }
    if ($iframe.attr("allowfullscreen") === undefined) {
      $iframe.attr("allowfullscreen", "");
    }
  });

  return root.html() || "";
}

export function patchYoutubeIframesInElement(root: ParentNode | null | undefined): void {
  if (!root || typeof root.querySelectorAll !== "function") return;

  root.querySelectorAll('iframe[src*="youtube"]').forEach((iframe) => {
    if (!iframe.getAttribute("referrerpolicy")) {
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    }
    if (!iframe.getAttribute("allow")) {
      iframe.setAttribute("allow", IFRAME_ALLOW);
    }
  });
}

export function sanitizeCkEditorContent(html: string): string {
  const prepared = prepareCkEditorContent(html);
  if (typeof window === "undefined") return prepared;
  return DOMPurify.sanitize(prepared, CK_SANITIZE_OPTIONS);
}

export function getYoutubePlayerConfig() {
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  return {
    youtube: {
      playerVars: { showinfo: 1, ...(origin ? { origin } : {}) },
    },
    file: {
      attributes: {
        controlsList: "nodownload",
      },
    },
  };
}
