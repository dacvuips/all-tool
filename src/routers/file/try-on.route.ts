import axios from "axios";
import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { decreaseGuestTryOnLimit, getGuestTryOnLimit } from "../../graphql/modules/guest/guest.helper";
import { credentialService } from "../../libs/dal/credential";
import { decryptProviderSecret } from "../../packages/encryption";

const MODEL_NAME = "gemini-2.5-flash-image";

// Load default background image
const DEFAULT_BG_PATH = path.join(process.cwd(), "public/static/assets/bg-tryon.jpg");
let defaultBackgroundData: { base64Data: string; mimeType: string } | null = null;

try {
  if (fs.existsSync(DEFAULT_BG_PATH)) {
    const buffer = fs.readFileSync(DEFAULT_BG_PATH);
    const base64Data = buffer.toString("base64");
    const ext = path.extname(DEFAULT_BG_PATH).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    defaultBackgroundData = { base64Data, mimeType };
    console.log("Default background image loaded successfully");
  } else {
    console.warn(`Default background image not found at: ${DEFAULT_BG_PATH}`);
  }
} catch (error) {
  console.error("Failed to load default background image:", error);
}

// Helper function to convert image URL to base64
const convertImageUrlToBase64 = async (url: string) => {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000, // 30 seconds timeout
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Convert arraybuffer to bas   e64 correctly
    const base64Data = Buffer.from(response.data).toString("base64");
    const contentType = response.headers["content-type"] || "image/jpeg";

    return {
      base64Data,
      mimeType: contentType,
    };
  } catch (error: any) {
    console.error("Error converting image URL to base64:", {
      url,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
    });
    throw new Error(`Failed to fetch image from URL: ${error.message}`);
  }
};

const callGeminiApiWithRetry = async (payload: any, maxRetries = 5) => {
  const getGeminiApi = (await credentialService.findAll({ limit: 1 }))[0]?.googleAIStudio;
  if (!getGeminiApi.active) {
    throw new Error("Gemini API Key is not active in credentials");
  }
  if (!getGeminiApi.value) {
    throw new Error("Gemini API Key is missing in credentials");
  }
  const API_KEY = decryptProviderSecret(getGeminiApi.value);

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
  let delay = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log(`Gemini API response status: ${response.status} ${response.statusText}`);

      if (response.status === 429 && i < maxRetries - 1) {
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API error response:", errorBody);
        throw new Error(
          `HTTP Error: ${response.status} - ${response.statusText}. Body: ${errorBody.substring(
            0,
            500
          )}`
        );
      }

      const result = await response.json();
      console.log("Gemini API call successful");
      return result;
    } catch (error: any) {
      console.error(`Gemini API attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) {
        throw error;
      }
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

export default [
  {
    method: "post",
    path: "/api/file/try-on",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const {
          modelImageUrl,
          garmentImageUrl,
          modelImage,
          garmentImage,
          backgroundImageUrl,
          backgroundImage,
          pose = "standing",
          angle = "front",
          actualWeight,
          actualHeight,
          prompt = "", // Keep for backward compatibility or additional instructions
          customerId,
          productId,  
        } = req.body;

        const limit = await getGuestTryOnLimit(req, customerId);
        if (limit <= 0) {
          res.status(400).json({
            error: "Bạn đã hết lượt thử đồ miễn phí. Vui lòng đăng nhập để nhận thêm lượt thử đồ.",
          });
          return;
        }

        // Check if we have either URLs or base64 data
        const hasUrls = modelImageUrl && garmentImageUrl;
        const hasBase64 = modelImage && garmentImage;

        if (!hasUrls && !hasBase64) {
          res.status(400).json({
            error:
              "Missing required images. Provide either modelImageUrl + garmentImageUrl or modelImage + garmentImage",
          });
          return;
        }

        // Convert URLs to base64 if needed
        let modelImageData = modelImage;
        let garmentImageData = garmentImage;
        let backgroundImageData = backgroundImage;

        if (hasUrls) {
          try {
             // Parallelize initial downloads
            const downloads = [
              convertImageUrlToBase64(modelImageUrl),
              convertImageUrlToBase64(garmentImageUrl),
            ];
            if (backgroundImageUrl) {
                downloads.push(convertImageUrlToBase64(backgroundImageUrl));
            }

            const results = await Promise.all(downloads);
            modelImageData = results[0];
            garmentImageData = results[1];
            if (backgroundImageUrl) {
                backgroundImageData = results[2];
            }

            console.log("Images converted successfully");
          } catch (conversionError: any) {
            console.error("Image conversion failed:", conversionError);
            res.status(400).json({
              error: `Failed to load images: ${conversionError.message}`,
            });
            return;
          }
        } else {
             // Handle potential base64 string input (if it lacks mimeType wrapper from client)
             // Assumes client currently sends structure, but let's be safe or just assume current structure
             // The existing code expected modelImage to be { base64Data, mimeType } OR raw string (logic for raw string was not fully visible but existing code used `modelImage` directly)
             // Actually, existing code lines 128-145 rename `modelImage` to `modelImageData`.
             // If client sends raw objects matching expected state, we are good.
             // If manual base64 was sent, we might need parsing.
             // User snippet `extractInlineData` handles `data:image/x;base64,y`.
             // Existing code `convertImageUrlToBase64` returns `{ base64Data, mimeType }`.
             // Let's standardise on `{ base64Data, mimeType }`.
        }
        
         // Helper to ensure data format
        const ensureData = (input: any) => {
            if (typeof input === 'string') {
                // assume data url
                 const [metadata, base64Data] = input.split(',');
                 const mimeTypeMatch = metadata.match(/:(.*?);/);
                 const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
                 return { base64Data, mimeType };
            }
            return input; // Assume it's already { base64Data, mimeType } if object
        }

        modelImageData = ensureData(modelImageData);
        garmentImageData = ensureData(garmentImageData);
        if (backgroundImageData) {
            backgroundImageData = ensureData(backgroundImageData);
        } else if (defaultBackgroundData) {
            backgroundImageData = defaultBackgroundData;
            console.log("Using default background image");
        }


        // Validate image data
        if (!modelImageData?.base64Data || !garmentImageData?.base64Data) {
          res.status(400).json({
            error: "Invalid image data. Missing base64Data.",
          });
          return;
        }     

        // --- Construction Logic from User ---

        const modelDescription = `Preserve the model’s face with 100% identity lock: identical facial features, proportions, expression, age, gender, ethnicity, and skin tone, with no face morphing or beautification; keep hair color and hairstyle exactly the same; allow only natural lighting and color adjustment to match the background without changing facial or skin identity; show the full body with correct anatomy, including both arms, hands, fingers, legs, and feet, with consistent skin tone; only change the clothing while keeping the original face, hair, body structure, and identity unchanged.`;
        const clothingDescription = `The person is wearing the exact outfit shown in the second image, copied as a strict 1:1 reference with identical colors, tones, saturation, patterns, prints, textures, fabric details, cut, shape, seams, and proportions; no modification, redesign, stylization, enhancement, addition, or removal is allowed, and any change to color, pattern, texture, or design is strictly forbidden.`;
        const poseDescription = pose === "sitting" 
          ? `The pose is sitting. The person is naturally seated on a suitable chair that fits the scene.` 
          : `The pose is ${pose}.`;
        const angleDescription = `The view is a ${angle} angle.`;
        const backgroundDescription = backgroundImageData ? `The background is the scenery from the third image. 
Integrate the person seamlessly into this background.
Ensure the person is entirely within the boundaries of this background, with accurate scale, perspective, and depth.
Match the lighting conditions (direction, intensity, color) and reflections from the background onto the person and their clothes.
Generate realistic shadows cast by the person that are consistent with the background's light source.
Maintain a natural composition where the person looks like they belong in the scene.` : `Use a clean, neutral studio background.`;
        const qualityDescription = `High detail, natural lighting, professional photography style.`;

        let weightDescription = '';
        if (actualWeight && actualWeight > 0) {
            weightDescription = `They weigh approximately ${actualWeight} kilograms.`;
        }

        let heightDescription = '';
        if (actualHeight && actualHeight > 0) {
            heightDescription = `They are approximately ${actualHeight} centimeters tall.`;
        }
        
        // Append user custom prompt if exists
        const customPrompt = prompt ? `Additional instructions: ${prompt}` : "";

        const promptText = `
        ${modelDescription}
        ${clothingDescription}
        ${poseDescription}
        ${angleDescription}
        ${weightDescription}
        ${heightDescription}
        ${backgroundDescription}
        ${qualityDescription}
        ${customPrompt}
        Combine these elements seamlessly to create a realistic image .
      `.trim();

        // Construct parts
        const parts: any[] = [
            {
                inlineData: {
                    mimeType: modelImageData.mimeType,
                    data: modelImageData.base64Data,
                }
            },
            { text: promptText },
             {
                inlineData: {
                    mimeType: garmentImageData.mimeType,
                    data: garmentImageData.base64Data,
                }
            },
        ];

        if (backgroundImageData) {
            parts.push({
                 inlineData: {
                    mimeType: backgroundImageData.mimeType,
                    data: backgroundImageData.base64Data,
                }
            });
        }

        const payload = {
          contents: [
            {
              role: "user",
              parts: parts,
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 0.4, // Good for realism
            candidateCount: 1,
          },
        //   systemInstruction: {
        //     parts: [{ text: systemPrompt }], // Removed as per new logic implicitly handling it in prompt
        //   },
        };    

        const result = await callGeminiApiWithRetry(payload);
        const candidate = result?.candidates?.[0];
        const imagePart = candidate?.content?.parts?.find(
          (p: any) => p.inlineData && p.inlineData.mimeType.startsWith("image/")
        );

        if (imagePart) {
          const base64Data = imagePart.inlineData.data;
          const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${base64Data}`;

          console.log("Try-on completed successfully", { customerId, productId });

          // Decrease guest limit
          let newLimit = 0;
          try {
            newLimit = await decreaseGuestTryOnLimit(req, customerId);
          } catch (redisError) {
            console.error("Error decreasing limit:", redisError);
          }

          // Return result with metadata
          res.status(200).json({
            resultImage: imageUrl,
            newLimit,
            metadata: {
              customerId,
              productId,
              pose,
              angle,
              timestamp: new Date().toISOString(),
              modelName: MODEL_NAME,
            },
          });
        } else {
             // Handle safety or other failures
           const safetyRatings = candidate?.safetyRatings;
           console.warn("Safety Ratings:", safetyRatings);
           
          const safetyReason =
            candidate?.finishReason === "SAFETY"
              ? " (Safety reason: Image or prompt violates policy)"
              : "";
          res.status(400).json({
            error: `Cannot generate image. Please try with different images or prompt.${safetyReason}`,
          });
        }
      } catch (error: any) {
        console.error("Try-on API error:", error);
        res.status(500).json({ error: error.message || "Failed to process try-on request" });
      }
    },
  },
];
