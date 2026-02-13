import { Request, Response } from "express";
import { SettingHelper } from "../../packages/setting-helper";
export default [
  {
    method: "get",
    path: "/api/setting/style.css",
    midd: [],
    action: async (req: Request, res: Response) => {
      const style = await SettingHelper.load("ad-css");
      res.type(".css");
      res.send(style);
      res.end();
    },
  },
];
