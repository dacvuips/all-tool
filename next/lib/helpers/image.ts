import axios from "axios";
import getConfig from "next/config";
import Resizer from "react-image-file-resizer";
const {
  publicRuntimeConfig: { upload },
} = getConfig();
export async function uploadImage(
  image: any,
  compressUpload?: boolean,
  compressUploadOption?: {
    width?: number;
    height?: number;
    quality?: number;
    type?: "JPEG" | "PNG" | "WEBP";
  }
): Promise<{ link: string }> {
  const data = new FormData();
  // điều kiện nén ảnh
  if (compressUpload) {
    const imgCompress = await compressUploadImage(image, compressUploadOption);
    data.append("image", imgCompress as any);
  } else {
    data.append("image", image);
  }

  try {
    if (location.hostname == "localhost") {
      await new Promise((res, rej) => {
        setTimeout(res, 2000);
      });
      return {
        link: `https://picsum.photos/${250 + Math.floor(Math.random() * 100)}`,
      };
    } else {
      // Use internal backend endpoint instead of external service to avoid CORS issues
      const res = await axios.post(upload.uploadImageApiLink, data);

      return res.data.data;
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}
export const compressUploadImage = async (
  file,
  compressUploadOption?: {
    width?: number;
    height?: number;
    quality?: number;
    type?: "JPEG" | "PNG" | "WEBP";
  }
) => {
  // nén ảnh
  const resizeFile = (file) =>
    new Promise((resolve) => {
      Resizer.imageFileResizer(
        file,
        compressUploadOption?.width || 1100,
        compressUploadOption?.height || 1100,
        compressUploadOption?.type || "JPEG",
        compressUploadOption?.quality || 60,
        0,
        (uri) => {
          resolve(uri);
        },
        "file"
      );
    });

  return await resizeFile(file);
};

export function compressImage(image: string, compress?: number): string {
  if (!image) return image;
  const imageUrl = image.toString().trim();
  if (imageUrl.includes("i.imgur.com")) {
    if (compress && !imageUrl.includes(".png")) {
      let suffix = "";
      if (compress < 100) suffix = "s";
      else if (compress < 200) suffix = "t";
      else if (compress < 350) suffix = "m";
      else if (compress < 650) suffix = "l";
      else suffix = "h";
      const dot = imageUrl.lastIndexOf(".");
      return imageUrl.slice(0, dot) + suffix + imageUrl.slice(dot);
    } else {
      return imageUrl;
    }
  } else {
    return `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}${
      compress ? `&w=${compress}` : ""
    }`;
  }
}
