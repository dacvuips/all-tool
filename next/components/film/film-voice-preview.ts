import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/providers/auth-provider";
import { useSettingPublic } from "../../lib/hooks/useSettingPublic";
import { previewFreeGenAudioVoice } from "../app/voice/free-voice-api";
import {
  getFreeVoicePreviewBlob,
  hasFreeVoicePreview,
  putFreeVoicePreviewBlob,
} from "../app/voice/free-voice-preview-idb";
import { isFreeGenAudioVoiceId } from "../app/voice/free-voice-voices";
import { filmFeatureBlockReason } from "./film-access";
import { voicePreviewUrl } from "../app/voice/voice-api";

export function useFilmVoicePreview(blob?: Blob, voiceId?: string) {
  const { customer } = useAuth();
  const blockSetting = useSettingPublic("pa-b-page");
  const marketplaceStopped = Boolean(blockSetting?.key);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasCached, setHasCached] = useState(Boolean(blob));
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef("");
  const previewBlobRef = useRef<Blob | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filmBlockedReason = filmFeatureBlockReason(customer, marketplaceStopped);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
    setLoading(false);
    setError("");
    revokeObjectUrl();
    previewBlobRef.current = null;
    setHasCached(Boolean(blob));

    const id = voiceId?.trim() || "";
    if (blob || !isFreeGenAudioVoiceId(id)) return;

    let cancelled = false;
    void (async () => {
      const cached = await getFreeVoicePreviewBlob(id);
      if (cancelled) return;
      if (cached) {
        previewBlobRef.current = cached;
        setHasCached(true);
      } else {
        const exists = await hasFreeVoicePreview(id);
        if (!cancelled) setHasCached(exists);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, voiceId, revokeObjectUrl]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      audioRef.current?.pause();
      revokeObjectUrl();
    },
    [revokeObjectUrl]
  );

  const canPreview = Boolean(blob || voiceId?.trim());

  const resolvePlaySrc = useCallback(async (): Promise<string> => {
    if (blob) {
      if (!objectUrlRef.current) {
        objectUrlRef.current = URL.createObjectURL(blob);
      }
      setHasCached(true);
      return objectUrlRef.current;
    }

    const id = voiceId?.trim() || "";
    if (!id) return "";

    if (isFreeGenAudioVoiceId(id)) {
      if (previewBlobRef.current) {
        if (!objectUrlRef.current) {
          objectUrlRef.current = URL.createObjectURL(previewBlobRef.current);
        }
        setHasCached(true);
        return objectUrlRef.current;
      }

      const cached = await getFreeVoicePreviewBlob(id);
      if (cached) {
        previewBlobRef.current = cached;
        revokeObjectUrl();
        objectUrlRef.current = URL.createObjectURL(cached);
        setHasCached(true);
        return objectUrlRef.current;
      }

      if (filmBlockedReason) {
        throw new Error(filmBlockedReason);
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const previewBlob = await previewFreeGenAudioVoice(id, ac.signal, { film: true });
        if (ac.signal.aborted) return "";
        previewBlobRef.current = previewBlob;
        await putFreeVoicePreviewBlob(id, previewBlob);
        setHasCached(true);
        revokeObjectUrl();
        objectUrlRef.current = URL.createObjectURL(previewBlob);
        return objectUrlRef.current;
      } finally {
        if (abortRef.current === ac) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    }

    return voicePreviewUrl(id);
  }, [blob, voiceId, revokeObjectUrl, filmBlockedReason]);

  const toggle = useCallback(async () => {
    if (loading) return;

    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }

    setError("");
    try {
      const src = await resolvePlaySrc();
      if (!src) return;

      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio(src);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.onpause = () => setPlaying(false);
      } else if (audio.src !== src) {
        audio.src = src;
      }

      await audio.play();
      setPlaying(true);
    } catch (err: any) {
      setPlaying(false);
      setLoading(false);
      const message = String(err?.message || "").trim();
      if (message && err?.name !== "AbortError") {
        setError(message);
      }
    }
  }, [loading, playing, resolvePlaySrc]);

  return { playing, loading, toggle, canPreview, hasCached, error, filmBlockedReason };
}
