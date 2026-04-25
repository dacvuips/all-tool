/**
 * AI Affiliate Video Workshop – affiliate-video.tsx
 * Styling: className only (Tailwind) — no inline styles, no style= props.
 */

import AffiliateVideo from "./affiliate-single";
import { AffiliateVideoProvider } from "./providers/affiliate-video-provider";

export default function AffiliateVideoPage() {
  return (
    <AffiliateVideoProvider>
      <AffiliateVideo />
    </AffiliateVideoProvider>
  );
}
