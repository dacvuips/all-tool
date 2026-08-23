import { useCallback, useEffect, useRef, useState } from "react";
import { previewFreeGenAudioVoice } from "../app/voice/free-voice-api";
import {
  getFreeVoicePreviewBlob,
  hasFreeVoicePreview,
  putFreeVoicePreviewBlob,
} from "../app/voice/free-voice-preview-idb";
import { isFreeGenAudioVoiceId } from "../app/voice/free-voice-voices";
import { voicePreviewUrl } from "../app/voice/voice-api";

export function useFilmVoicePreview(blob?: Blob, voiceId?: string) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasCached, setHasCached] = useState(Boolean(blob));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef("");
  const previewBlobRef = useRef<Blob | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const previewBlob = await previewFreeGenAudioVoice(id, ac.signal);
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
  }, [blob, voiceId, revokeObjectUrl]);

  const toggle = useCallback(async () => {
    if (loading) return;

    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }

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

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [loading, playing, resolvePlaySrc]);

  return { playing, loading, toggle, canPreview, hasCached };
}
