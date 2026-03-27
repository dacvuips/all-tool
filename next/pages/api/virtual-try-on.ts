import type { NextApiRequest, NextApiResponse } from "next";

export interface TryOnItem {
  type: "clothing" | "shoes" | "jewelry" | "accessory";
  image: string; // base64 data URL or http URL
  prompt: string;
}

export interface TryOnRequest {
  apiKey: string;
  personImage: string; // base64 data URL or http URL
  personPrompt: string;
  pose: string;
  cleaningPrompt: string;
  items: TryOnItem[];
  mode: "single" | "batch";
  /** Batch mode only: pass previous result image so only specified slot changes */
  previousResultImage?: string;
  /** Batch mode: indices of items being changed this run */
  changingItemTypes?: string[];
}

async function toBase64(src: string): Promise<{ data: string; mimeType: string }> {
  if (src.startsWith("data:")) {
    const [header, data] = src.split(",");
    const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    return { data, mimeType };
  }
  // fetch remote URL
  const resp = await fetch(src);
  const buf = await resp.arrayBuffer();
  const data = Buffer.from(buf).toString("base64");
  const mimeType = resp.headers.get("content-type") || "image/jpeg";
  return { data, mimeType };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body: TryOnRequest = req.body;
    const {
      apiKey,
      personImage,
      personPrompt,
      pose,
      cleaningPrompt,
      items,
      mode,
      previousResultImage,
      changingItemTypes,
    } = body;

    if (!apiKey) {
      return res
        .status(400)
        .json({ error: "Gemini API key is required. Please add it in Settings." });
    }
    if (!personImage && !previousResultImage) {
      return res.status(400).json({ error: "Person image is required." });
    }

    // ── Build Prompt ──────────────────────────────────────────────────────────
    const poseLabel: Record<string, string> = {
      front: "standing upright, facing forward",
      tilt_left: "tilting slightly to the left",
      tilt_right: "tilting slightly to the right",
      turn_left: "turning to the left (3/4 view)",
      turn_right: "turning to the right (3/4 view)",
      back: "facing backward (back view)",
    };
    const poseDesc = poseLabel[pose] || "standing upright, facing forward";

    const cleanPrompt =
      cleaningPrompt ||
      "First, completely remove ALL existing clothing, shoes, accessories and jewelry from the person, leaving only their bare body, face, skin and hair intact.";

    // In batch mode, we only change the specified item types
    const activeItems =
      mode === "batch" && changingItemTypes?.length
        ? items.filter((it) => changingItemTypes.includes(it.type))
        : items;

    let mainPrompt = `You are a professional fashion photo editor.

TASK: Virtual try-on — dress the person in the provided reference images.

STEP 1 — CLEAN: ${cleanPrompt}

STEP 2 — POSE: Position the person ${poseDesc}.${
      personPrompt ? `\nPerson notes: ${personPrompt}.` : ""
    }

STEP 3 — DRESS: Apply the following items exactly as they appear in their reference images:
`;
    const typeLabel: Record<string, string> = {
      clothing: "👕 Clothing / Outfit",
      shoes: "👟 Shoes / Footwear",
      jewelry: "💎 Jewelry",
      accessory: "👜 Accessory",
    };
    activeItems.forEach((item, idx) => {
      mainPrompt += `  ${idx + 1}. ${typeLabel[item.type] || item.type}${
        item.prompt ? ` — ${item.prompt}` : ""
      }.\n`;
    });

    if (mode === "batch" && changingItemTypes?.length) {
      mainPrompt += `\nIMPORTANT: Only replace the item types listed above. Keep all other clothing and accessories from the base image EXACTLY the same.\n`;
    }

    mainPrompt += `\nFINAL OUTPUT: A single, photorealistic fashion photo. Preserve the person's face, body proportions, and skin tone perfectly. High resolution, professional studio lighting, clean white background.`;

    // ── Build Gemini Parts ────────────────────────────────────────────────────
    const parts: any[] = [{ text: mainPrompt }];

    // Base image: in batch mode use previousResult if available, else use personImage
    const baseImg = mode === "batch" && previousResultImage ? previousResultImage : personImage;
    if (baseImg) {
      const { data, mimeType } = await toBase64(baseImg);
      parts.push({ text: "📷 Base person image:" });
      parts.push({ inlineData: { mimeType, data } });
    }

    // Item reference images
    for (const item of activeItems) {
      if (item.image) {
        const { data, mimeType } = await toBase64(item.image);
        parts.push({ text: `🖼 Reference for ${typeLabel[item.type] || item.type}:` });
        parts.push({ inlineData: { mimeType, data } });
      }
    }

    // ── Call Gemini ───────────────────────────────────────────────────────────
    const model = (req.query.model as string) || "gemini-2.5-flash-image";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          temperature: 1,
          topP: 0.95,
          topK: 40,
        },
      }),
    });

    const geminiData = await geminiResp.json();

    if (!geminiResp.ok) {
      const msg = geminiData?.error?.message || "Gemini API error";
      console.error("[virtual-try-on] Gemini error:", geminiData);
      return res.status(500).json({ error: msg });
    }

    const candidates = geminiData.candidates || [];
    if (!candidates.length) {
      return res.status(500).json({ error: "No candidates returned from Gemini." });
    }

    const responseParts: any[] = candidates[0]?.content?.parts || [];
    let resultImage: string | null = null;
    let resultText = "";

    for (const part of responseParts) {
      if (part.inlineData) {
        resultImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      } else if (part.text) {
        resultText += part.text;
      }
    }

    return res.status(200).json({ success: true, image: resultImage, text: resultText });
  } catch (err: any) {
    console.error("[virtual-try-on API] Unhandled error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: "50mb" },
  },
};
