/**
 * Normalize / build signer endpoint URLs (MLS V13.3 compatible).
 */
export function normalizeSignerBaseUrl(raw: string): string {
  let u = String(raw || "").trim();
  if (!u) return "";
  u = u.replace(/\/+$/, "");
  u = u.replace(/\/api\/sign$/i, "");
  u = u.replace(/\/sign$/i, "");
  u = u.replace(/\/api$/i, "");
  return u.replace(/\/+$/, "");
}

export function buildSignerEndpoints(base: string) {
  const root = normalizeSignerBaseUrl(base);
  return {
    root,
    /** MLS: POST credit_url nguyên (thường .../api/sign); ta normalize rồi dựng lại */
    sign: `${root}/api/sign`,
    signAlt: `${root}/sign`,
    generateToken: `${root}/generate_token`,
    /**
     * MLS createPostViaCredit: credit_url.replace(/\/api\/sign\/?$/, '') + '/api/createpost'
     * (không có underscore — /api/create_post chỉ là fallback)
     */
    createPost: `${root}/api/createpost`,
    createPostAlt: `${root}/api/create_post`,
    me: `${root}/api/me`,
    meAlt: `${root}/me`,
  };
}

export function meCandidateUrls(roots: string[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const raw of roots) {
    const root = normalizeSignerBaseUrl(raw);
    if (!root) continue;
    for (const path of ["/api/me", "/me"]) {
      const u = `${root}${path}`;
      if (seen.has(u)) continue;
      seen.add(u);
      urls.push(u);
    }
  }
  return urls;
}
