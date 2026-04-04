export const AffiliateVideoResponseSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "AffiliateVideoSchema",
  type: "object",
  properties: {
    topicTitle: { type: "string" },
    artStyle: { type: "string" },
    environment: { type: "string" },
    cast: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          tag: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
    },
    characterName: { type: "string" },
    characterBaseDescription: { type: "string" },
    voiceGender: { type: "string" },
    voiceTone: { type: "string" },
    voiceStyle: { type: "string" },
    audioPrompt: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sceneNumber: { type: "integer" },
          camera: { type: "string" },
          visualPrompt: { type: "string" },
          imagePrompt: { type: "string" },
          motionPrompt: { type: "string" },
          audio: { type: "string" },
          dialogue: { type: "string" },
        },
        required: ["sceneNumber", "visualPrompt", "imagePrompt", "motionPrompt", "dialogue"],
      },
    },
  },
  required: ["topicTitle", "characterBaseDescription", "scenes"],
};
