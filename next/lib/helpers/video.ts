import { AttachmentService } from "../repo/attachment/attachment.repo";

type UploadMediaResult = {
  link: string;
  name?: string;
  mimetype?: string;
  size?: number;
};

export async function uploadMedia(file: File): Promise<UploadMediaResult> {
  try {
    const response = await AttachmentService.uploadFile(file, "video");
    const payload = response?.data || response;
    const item = payload?.data || payload;
    const link = item?.downloadUrl || item?.link || item?.url;

    if (!link) {
      throw new Error("Upload media succeeded but no URL was returned");
    }

    return {
      link,
      name: item?.name || file?.name,
      mimetype: item?.mimetype || file?.type,
      size: item?.size || file?.size,
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
