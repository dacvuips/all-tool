import axios from "axios";
import getConfig from "next/config";
const {
  publicRuntimeConfig: { upload },
} = getConfig();
export async function uploadImage(file: File, host: "imgur" | "fpt" = "imgur") {
  switch (host) {
    case "imgur": {
      const data = new FormData();
      data.append("image", file);

      try {
        let res = await axios.post(upload.uploadImageApiLink, data);
        return res.data.data;
      } catch (err) {
        try {
          let res = await axios.post(upload.uploadImageApiLink, data);
          return res.data.data;
        } catch (err) {
          console.error(err);
          throw err;
        }
      }
    }
    default:
      break;
  }
}
