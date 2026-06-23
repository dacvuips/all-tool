import { useAuth } from "../../../../lib/providers/auth-provider";
import { useScreen } from "../../../../lib/hooks/useScreen";

/** Intro guide chỉ bật trên desktop (md+) và khi customer đã đăng nhập */
export function useAffiliateIntroEnabled(): boolean {
  const isMd = useScreen("md");
  const { customer } = useAuth();
  return isMd === true && !!customer;
}
