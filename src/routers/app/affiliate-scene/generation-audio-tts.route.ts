import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { callWithKeyRotation, getAvailableGeminiClients, incrementRequestCount } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-audio-tts/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          /** The text/dialogue to convert to speech */
          text: string;
          /** Voice name (e.g. "Kore", "Puck", "Aoede", etc.) */
          voiceName?: string;
          /** Optional style/tone instructions prepended to the text */
          stylePrompt?: string;
        };

        if (!body?.text) {
          return res.status(400).json({ message: "Thiếu text để tạo giọng nói" });
        }

        const clients = await getAvailableGeminiClients();

        const voiceName = body.voiceName || "Kore";
        const textContent = body.stylePrompt ? `${body.stylePrompt}\n\n${body.text}` : body.text;

        logger.info(`[generation-tts] Gọi Gemini TTS (voice: ${voiceName}) cho user ${context.id}`);

        const response = await callWithKeyRotation(
          clients,
          (ai) =>
            ai.models.generateContent({
              model: "gemini-2.5-flash-preview-tts",
              contents: [{ role: "user", parts: [{ text: textContent }] }],
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName,
                    },
                  },
                },
              } as any,
            }),
          "generation-tts"
        );

        // Extract audio from response
        const parts = (response as any).candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find((part: any) => part.inlineData);

        if (!audioPart?.inlineData?.data) {
          return res.status(500).json({ message: "Không nhận được audio từ API" });
        }

        const rawBase64 = audioPart.inlineData.data;
        const rawMimeType = audioPart.inlineData.mimeType || "audio/L16;rate=24000";

        // Parse sample rate from mimeType (e.g. "audio/L16;rate=24000")
        const rateMatch = rawMimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        const bitsPerSample = 16;
        const numChannels = 1;

        // Decode raw PCM base64 to Buffer
        const pcmBuffer = Buffer.from(rawBase64, "base64");
        const dataLength = pcmBuffer.length;

        // Build WAV header (44 bytes) for 16-bit mono PCM
        const wavHeader = Buffer.alloc(44);
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);

        wavHeader.write("RIFF", 0);
        wavHeader.writeUInt32LE(36 + dataLength, 4); // ChunkSize
        wavHeader.write("WAVE", 8);
        wavHeader.write("fmt ", 12);
        wavHeader.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
        wavHeader.writeUInt16LE(1, 20); // AudioFormat (PCM = 1)
        wavHeader.writeUInt16LE(numChannels, 22);
        wavHeader.writeUInt32LE(sampleRate, 24);
        wavHeader.writeUInt32LE(byteRate, 28);
        wavHeader.writeUInt16LE(blockAlign, 32);
        wavHeader.writeUInt16LE(bitsPerSample, 34);
        wavHeader.write("data", 36);
        wavHeader.writeUInt32LE(dataLength, 40);

        // Combine header + PCM data → full WAV file
        const wavBuffer = Buffer.concat([new Uint8Array(wavHeader), new Uint8Array(pcmBuffer)]);
        const wavBase64 = wavBuffer.toString("base64");

        await incrementRequestCount(context.id);

        res.json({
          success: true,
          data: {
            audioBytes: wavBase64,
            mimeType: "audio/wav",
            sampleRate,
            durationMs: Math.round(
              (dataLength / (sampleRate * numChannels * (bitsPerSample / 8))) * 1000
            ),
          },
        });
      } catch (err: any) {
        logger.error(`[generation-tts] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
