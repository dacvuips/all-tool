import { Request, Response } from "express";
import { SettingHelper } from "../../packages/setting-helper";
export default [
  {
    method: "get",
    path: "/api/setting/script.js",
    midd: [],
    action: async (req: Request, res: Response) => {
      const script = await SettingHelper.load("ad-script");
      res.type(".js");
      res.send(script);
      res.end();
    },
  },
];
