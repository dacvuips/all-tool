import axios from "axios";

export namespace Casso {
  export function sync(apiKey: string, bankAccId: string) {
    return axios
      .post(
        "https://oauth.casso.vn/v2/sync",
        {
          bank_acc_id: bankAccId,
        },
        {
          headers: {
            Authorization: `Apikey ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      )
      .then((res) => {
        return res.data;
      });
  }
}
