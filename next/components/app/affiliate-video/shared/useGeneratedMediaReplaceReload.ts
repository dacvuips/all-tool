/**
 * Scene card reload ảnh/video khi file gốc bị thay thế (xóa logo).
 */
import { useEffect } from "react";
import { subscribeGeneratedMediaReplaced } from "./generatedMediaReplaceBus";
import {
  hasPendingGeneratedVideoBase64,
  resumePendingGeneratedImageBinary,
  resumePendingGeneratedVideoBase64,
  toUiGeneratedImage,
  toUiGeneratedVideo,
} from "./generatedMediaUtils";

export function useGeneratedMediaReplaceReload(args: {
  sceneId: string;
  nextSceneId?: string;
  getGeneratedImage: (id: string) => Promise<any>;
  getGeneratedVideo: (id: string) => Promise<any>;
  saveGeneratedImage: (id: string, data: any) => Promise<void>;
  saveGeneratedVideo: (id: string, data: any) => Promise<void>;
  setGeneratedImage: (data: any) => void;
  setNextGeneratedImage: (data: any) => void;
  setGeneratedVideo: (data: any) => void;
  setGeneratedExtendVideo: (data: any) => void;
}) {
  const {
    sceneId,
    nextSceneId,
    getGeneratedImage,
    getGeneratedVideo,
    saveGeneratedImage,
    saveGeneratedVideo,
    setGeneratedImage,
    setNextGeneratedImage,
    setGeneratedVideo,
    setGeneratedExtendVideo,
  } = args;

  useEffect(() => {
    return subscribeGeneratedMediaReplaced((event) => {
      if (event.kind === "image") {
        if (event.sceneId === sceneId) {
          void getGeneratedImage(sceneId).then(async (img) => {
            if (!img) return;
            await resumePendingGeneratedImageBinary(
              sceneId,
              img,
              { set: saveGeneratedImage },
              { onUpdate: (data) => setGeneratedImage(data) }
            );
          });
        }
        if (nextSceneId && event.sceneId === nextSceneId) {
          void getGeneratedImage(nextSceneId).then((img) => {
            setNextGeneratedImage(img ? toUiGeneratedImage(img) : null);
          });
        }
      }

      if (event.kind === "video" && event.sceneId === sceneId) {
        void getGeneratedVideo(sceneId).then(async (vid) => {
          if (!vid) return;
          setGeneratedVideo(toUiGeneratedVideo(vid));
          if (!hasPendingGeneratedVideoBase64(vid)) return;
          await resumePendingGeneratedVideoBase64(
            sceneId,
            vid,
            { set: saveGeneratedVideo },
            { onUpdate: (data) => setGeneratedVideo(data) }
          );
        });
      }

      if (event.kind === "extend" && event.sceneId === sceneId) {
        const stitchId = `${sceneId}::stitch`;
        void getGeneratedVideo(stitchId).then(async (vid) => {
          if (!vid) return;
          setGeneratedExtendVideo(toUiGeneratedVideo(vid));
          if (!hasPendingGeneratedVideoBase64(vid)) return;
          await resumePendingGeneratedVideoBase64(
            stitchId,
            vid,
            { set: saveGeneratedVideo },
            { onUpdate: (data) => setGeneratedExtendVideo(data) }
          );
        });
      }
    });
  }, [
    sceneId,
    nextSceneId,
    getGeneratedImage,
    getGeneratedVideo,
    saveGeneratedImage,
    saveGeneratedVideo,
    setGeneratedImage,
    setNextGeneratedImage,
    setGeneratedVideo,
    setGeneratedExtendVideo,
  ]);
}
