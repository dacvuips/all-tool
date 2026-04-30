/**
 * AI Affiliate Video Workshop – affiliate-video.tsx
 * Styling: className only (Tailwind) — no inline styles, no style= props.
 */

import { default as AffiliateMainPage } from "./affiliate-main-page";
import { AffiliateVideoProvider } from "./single/providers/affiliate-video-provider";

export default function AffiliateVideoPage() {
  return (
    <AffiliateVideoProvider>
      <AffiliateMainPage />
    </AffiliateVideoProvider>
  );
}
