import { Type } from "@google/genai";

export const AffiliateVideoResponseSchema = {
  type: Type.OBJECT,
  properties: {
    topicTitle: { type: Type.STRING },
    artStyle: { type: Type.STRING },
    environment: { type: Type.STRING },
    cast: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tag: { type: Type.STRING },
        },
        required: ["tag"],
      },
    },
    characterName: { type: Type.STRING },
    characterBaseDescription: { type: Type.STRING },
    voiceGender: { type: Type.STRING },
    voiceTone: { type: Type.STRING },
    voiceStyle: { type: Type.STRING },
    audioPrompt: { type: Type.STRING },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneNumber: { type: Type.INTEGER },
          camera: { type: Type.STRING },
          motionPrompt: { type: Type.STRING },
          audio: { type: Type.STRING },
          dialogue: { type: Type.STRING },
          visualEffects: { type: Type.STRING },
        },
        required: ["sceneNumber", "motionPrompt", "dialogue", "visualEffects"],
      },
    },
  },
  required: ["topicTitle", "characterBaseDescription", "scenes"],
};
