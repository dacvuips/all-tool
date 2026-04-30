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
export enum StoryModeTypeEnum {
  prompt_to_video = "prompt_to_video",
  image_to_video = "image_to_video",
}

export enum ArtStyleMapEnum {
  PIXAR = "Pixar",
  PIXAR_REALISTIC = "Pixar_Realistic",
  REALISTIC = "Realistic",
  CROCHET = "Crochet",
  CLAY = "Clay",
  DIORAMA = "Diorama",
  LEGO = "Lego",
  MANNEQUIN = "Mannequin",
  ZACK_DOGE = "Zack_Doge",
  CHALKBOARD = "Chalkboard",
  MINIMALIST_2D = "2D_Minimalist",
  STICKMAN = "Stickman",
  SIMPSONS = "Simpsons",
  BUSINESS = "Business",
  CINEMATIC_DARK = "Cinematic_Dark",
  DARK_FANTASY = "Dark_Fantasy",
  ANIME = "Anime",
  GAME_2D = "Game_2D",
  DARK_GROTESQUE = "Dark_Grotesque",
  FLAT_SCIENCE = "Flat_Science",
}

export const ArtStyleMap: Array<{
  value: ArtStyleMapEnum;
  des: string;
}> = [
  {
    value: ArtStyleMapEnum.PIXAR,
    des: "3D Pixar Cute style, 9:16 aspect ratio, 4k, realistic textures but cartoon proportions, vibrant colors, expressive lighting.",
  },
  {
    value: ArtStyleMapEnum.PIXAR_REALISTIC,
    des: "3D Pixar Animation Style but with HYPER-REALISTIC textures and lighting. Characters have Pixar proportions (large eyes, expressive faces) but skin texture, hair, and clothing materials look real. Cinematic lighting, octane render, 8k. ",
  },
  {
    value: ArtStyleMapEnum.REALISTIC,
    des: "Cinematic realistic lighting, 8k, photorealistic, high fidelity, shot on 35mm lens, depth of field, natural colors. DO NOT USE '3d', 'render' or 'cartoon' keywords.",
  },
  {
    value: ArtStyleMapEnum.CROCHET,
    des: "Crochet Amigurumi style, entire world and characters made of yarn and knitted wool, cute handmade doll aesthetic, soft fuzz texture, macro photography, depth of field, bright soft lighting.",
  },
  {
    value: ArtStyleMapEnum.CLAY,
    des: "Claymation style, stop-motion aesthetic, characters and world made of plasticine clay, fingerprints visible on texture, Aardman animation style, soft studio lighting, playful and tactile look.",
  },
  {
    value: ArtStyleMapEnum.DIORAMA,
    des: "Miniature Diorama style, tilt-shift photography effect, macro lens, clay figurine characters, tiny scale world, high depth of field blur (bokeh), intricate tiny details, warm cozy lighting.",
  },
  {
    value: ArtStyleMapEnum.LEGO,
    des: "LEGO brick style, everything built from lego blocks, plastic texture with glossy finish, lego minifigure characters, vibrant colors, frantic fun lighting, digital brick film aesthetic.",
  },
  {
    value: ArtStyleMapEnum.MANNEQUIN,
    des: "Hyper-surreal 3D cinematic render. Characters are stylized mannequins with smooth, featureless white porcelain faces — NO eyes, NO mouth, NO nose, NO facial features at all — just a blank smooth oval head. Realistic highly-detailed clothing, props, and environment. Dramatic cinematic lighting, volumetric fog, muted desaturated color palette with cold blue-grey tones. Octane render, 8k, photorealistic textures on clothing and props, shallow depth of field.",
  },
  {
    value: ArtStyleMapEnum.ZACK_DOGE,
    des: "Hyper-surreal 3D cinematic render. Characters are stylized mannequins with smooth, featureless white porcelain faces — NO eyes, NO mouth, NO nose, NO facial features at all — just a blank smooth oval head. Realistic highly-detailed clothing, props, and environment. Dramatic cinematic lighting, volumetric fog, muted desaturated color palette with cold blue-grey tones. Octane render, 8k, photorealistic textures on clothing and props, shallow depth of field.",
  },
  {
    value: ArtStyleMapEnum.CHALKBOARD,
    des: "Chalkboard Animation style, Minimalist Line Art. Dark green textured chalkboard background similar to a school blackboard. White chalk-like strokes, hand-drawn aesthetic, educational and nostalgic vibe. Characters are extremely simple, stylized stick figures or basic geometric shapes, absolutely no complex details or colors. Focus heavily on expressive details: tears, forehead wrinkles, stooped posture to convey emotion directly. High contrast, instructional feel.",
  },
  {
    value: ArtStyleMapEnum.MINIMALIST_2D,
    des: "2D Minimalist Animation with Visual Storytelling style. Characters are iconic simplified figures with white skin, thin but clear black vector outlines, and rounded soft shapes that feel friendly and approachable. Flat Design technique with uniform solid color blocks, minimal shadows, clean frames. Facial expressions and body language are the primary storytelling tools — all unnecessary details are stripped away. Abstract concepts are visualized through metaphorical imagery (e.g., overprotection = character inside a crystal sphere, generations = era-specific symbolic objects). Modern educational graphic style optimized for online platforms, making complex topics visually engaging and emotionally resonant.",
  },
  {
    value: ArtStyleMapEnum.STICKMAN,
    des: "Stickman Animation style, simple black stick figure characters on white or light-colored background. Characters are basic line-drawn stick figures with circle heads, straight line bodies and limbs, minimal facial features (dot eyes, simple curved mouth). Clean white background or very simple flat-color environments. Exaggerated poses and body language for clear emotion and action. Bold black lines, no shading, no textures. Comedy and storytelling driven by movement and situation rather than visual detail. Think classic whiteboard animation or xkcd comic style.",
  },
  {
    value: ArtStyleMapEnum.SIMPSONS,
    des: "The Simpsons cartoon style, 2D hand-drawn animation aesthetic. Characters have bright yellow skin, large round eyes with black pupils, overbite, and 4 fingers per hand. Bold black outlines, flat vibrant colors, slightly exaggerated proportions. Backgrounds are colorful and simplified suburban American settings. Classic Matt Groening art style with warm saturated palette, cel-shaded look, comedic and expressive character poses.",
  },
  {
    value: ArtStyleMapEnum.BUSINESS,
    des: "Modern 2D Flat Animation, Business Explainer style. Characters have natural skin tones, professional office attire (suits, blazers, ties), confident body language and polished appearance. Crisp sharp vector graphics with clean lines. Data Visualization elements integrated naturally: money jars, gears, balance scales, crossroad paths, pie charts, upward arrows as visual metaphors for abstract economic concepts. Bright cheerful color palette, clean minimal compositions, flat design with subtle gradients. Professional educational aesthetic that makes financial and business information visually engaging and easy to understand.",
  },
  {
    value: ArtStyleMapEnum.CINEMATIC_DARK,
    des: "Cinematic Dark Surrealism style, vibrant colors, Pixar-style lighting, high detail, clean studio background, ultra clean composition, social media thumbnail style, octane render, 8k.",
  },
  {
    value: ArtStyleMapEnum.DARK_FANTASY,
    des: "A cinematic dark folk illustration depicting traditional rural life and mystical herbal healing. The aesthetic is a hybrid of digital painting and chalkboard art, featuring dusty chalk textures and chalk-like linework. The artwork features elderly Asian characters in old village settings, wearing traditional clothing such as conical hats and simple garments. The atmosphere is moody and dramatic, with cold tones contrasted by warm glowing light representing inner energy, heat, or life force. Elements of fantasy realism are present, such as visible energy flowing inside the body, glowing hands, steam, or magical effects from herbs and food. Highly detailed textures, realistic anatomy, expressive emotions, and storytelling composition. Soft fog, smoke, firelight, cinematic lighting + dramatic shadows. Glowing energy / steam / warmth vs cold. Elderly Asian villager, realistic face, emotional expression. Digital painting blended with chalkboard art, textured chalk strokes over realistic shading, rich textures, dramatic lighting.",
  },
  {
    value: ArtStyleMapEnum.ANIME,
    des: "Authentic Japanese Anime style, high quality 2D animation aesthetic. Cel-shaded characters with expressive eyes, clean detailed linework, vibrant and atmospheric lighting. Detailed background art with soft gradients and rich environmental storytelling, reminiscent of high-end anime movies. Dynamic composition, emotional mood, vivid saturated colors.",
  },
  {
    value: ArtStyleMapEnum.GAME_2D,
    des: "A colorful 2D cartoon illustration in a casual mobile game style. The character is stylized with simplified anatomy, smooth outlines, and exaggerated features such as large head, expressive face, and dynamic pose. Bright, vibrant colors with soft gradients and clean shading. The environment is minimalistic and game-like, with simple geometric shapes and clear objects (elevator, lamp, background walls). Flat lighting, no heavy shadows, polished vector-like rendering. Cute, playful, and energetic mood. High clarity, smooth lines, suitable for mobile game UI or animation.",
  },
  {
    value: ArtStyleMapEnum.DARK_GROTESQUE,
    des: "Semi-realistic 3D cinematic render with grotesque aesthetic. Characters have slightly stylized proportions — not fully photorealistic but NOT cartoon-cute either. Exaggerated distorted facial expressions (wide bulging eyes, unnaturally broad grins, extreme frowns, overacting emotions) with glossy 3D skin that feels uncanny and slightly artificial. Subsurface scattering on skin, octane render. Grimy industrial setting — dirty factory kitchen, rusty pipes, moldy walls, dim flickering fluorescent lighting, cold blue-grey color grading. Dark comedy tone with unsettling atmosphere. Props include suspicious food ingredients, chemical buckets, crumpled cash, dirty aprons. Cinematic dramatic lighting with harsh shadows, ultra detailed textures on environment, 8k. TikTok viral shock content aesthetic — designed to provoke curiosity and mild disgust while remaining watchable.",
  },
  {
    value: ArtStyleMapEnum.FLAT_SCIENCE,
    des: "2D flat educational science cartoon illustration style. Infographic aesthetic, clean vector-like outlines, simple shapes, no realism, no complex textures. Soft pastel color palette (light blues, greens, pale yellows) with moderate contrast. Minimal soft shading, flat lighting, no cinematic lighting. Characters, animals, and environments (like laboratories, nature, biology, DNA) are stylized, simplified, friendly, and highly informative. Similar to biology textbook diagrams or educational explainer animations.",
  },
];
