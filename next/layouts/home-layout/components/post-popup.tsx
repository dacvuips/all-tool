import { useGlobalContext } from "../../../lib/providers/global-provider";
import { PostPopupCard } from "../../../components/shared/common/post-popup-card";

export function PostPopup() {
  const { postPopup } = useGlobalContext();

  return (
    <>
      <PostPopupCard postPopup={postPopup} />
    </>
  );
}
