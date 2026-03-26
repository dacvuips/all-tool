import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";

export type AppPageSlug = {
  slug: string;
  filename: string;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // process.cwd() = monorepo root (all-tool), Next.js project nằm trong thư mục next/
    const appDir = path.join(process.cwd(), "next", "pages", "app");

    if (!fs.existsSync(appDir)) {
      return res.status(200).json({ slugs: [] });
    }

    const files = fs.readdirSync(appDir);

    const EXCLUDED = new Set(["_app", "_document", "index", "404", "500"]);
    const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

    const slugs: AppPageSlug[] = files
      .filter((file) => {
        const ext = path.extname(file);
        if (!EXTENSIONS.includes(ext)) return false;
        const name = path.basename(file, ext);
        // Bỏ qua các file đặc biệt và file bắt đầu bằng _
        if (EXCLUDED.has(name) || name.startsWith("_")) return false;
        // Bỏ qua dynamic routes như [slug].tsx
        if (name.startsWith("[")) return false;
        return true;
      })
      .map((file) => {
        const ext = path.extname(file);
        const slug = path.basename(file, ext);
        return { slug, filename: file };
      })
      .sort((a, b) => a.slug.localeCompare(b.slug));

    return res.status(200).json({ slugs });
  } catch (err: any) {
    console.error("[app-pages API] Error:", err);
    return res.status(500).json({ error: "Failed to read app pages directory" });
  }
}
