/** Mỗi đoạn audio gửi phân tích tối đa 2 phút. */
export const AUDIO_ANALYZE_CHUNK_SEC = 120;

export type AudioChunk = {
  audioBytes: string;
  mimeType: string;
  /** Index 0-based */
  chunkIndex: number;
  /** Tổng số chunk */
  chunkCount: number;
  /** Thời điểm bắt đầu trong audio gốc (giây) */
  startSec: number;
  /** Thời điểm kết thúc trong audio gốc (giây) */
  endSec: number;
};

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function audioBufferToWavBase64(buffer: AudioBuffer): string {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const samples = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function sliceAudioBuffer(
  source: AudioBuffer,
  startSec: number,
  endSec: number,
  ctx: BaseAudioContext
): AudioBuffer {
  const sampleRate = source.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(source.length, Math.ceil(endSec * sampleRate));
  const frameCount = Math.max(1, endSample - startSample);
  const sliced = ctx.createBuffer(source.numberOfChannels, frameCount, sampleRate);
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const src = source.getChannelData(ch).subarray(startSample, endSample);
    sliced.copyToChannel(src, ch, 0);
  }
  return sliced;
}

/**
 * Cắt audio base64 thành các đoạn tối đa `chunkSec` giây (mặc định 2 phút).
 * Audio ≤ 2 phút → 1 chunk (giữ nguyên mime nếu có thể; encode WAV khi phải cắt).
 */
export async function splitAudioBase64IntoChunks(options: {
  audioBytes: string;
  mimeType?: string;
  chunkSec?: number;
}): Promise<AudioChunk[]> {
  const chunkSec = options.chunkSec ?? AUDIO_ANALYZE_CHUNK_SEC;
  const mimeType = options.mimeType || "audio/mpeg";
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext || (window as any).webkitAudioContext
      : null;
  if (!AudioCtx) {
    throw new Error("Trình duyệt không hỗ trợ cắt audio");
  }

  const ctx: AudioContext = new AudioCtx();
  try {
    const arrayBuffer = base64ToArrayBuffer(options.audioBytes);
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const duration = decoded.duration || 0;
    if (!duration || !Number.isFinite(duration)) {
      throw new Error("Không đọc được độ dài audio");
    }

    if (duration <= chunkSec + 0.05) {
      return [
        {
          audioBytes: options.audioBytes,
          mimeType,
          chunkIndex: 0,
          chunkCount: 1,
          startSec: 0,
          endSec: duration,
        },
      ];
    }

    const chunkCount = Math.ceil(duration / chunkSec);
    const chunks: AudioChunk[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const startSec = i * chunkSec;
      const endSec = Math.min(duration, startSec + chunkSec);
      const sliced = sliceAudioBuffer(decoded, startSec, endSec, ctx);
      chunks.push({
        audioBytes: audioBufferToWavBase64(sliced),
        mimeType: "audio/wav",
        chunkIndex: i,
        chunkCount,
        startSec,
        endSec,
      });
    }
    return chunks;
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
