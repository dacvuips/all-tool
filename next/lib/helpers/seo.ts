export default async function SEO(
  title: string,
  data: { description?: string; image?: string; keyword?: string } = {}
) {
  return {
    titleTemplate: `%s | Cùng nông dân ra đồng`,
    defaultTitle: `Cùng nông dân ra đồng`,
    title,
    description: data.description,
    image: data.image,
    openGraph: {
      type: "website",
      locale: "vi_VN",
      site_name: "Lộc Trời - Cùng Nông Dân Ra Đồng",
      title,
      description: data.description,
      images: [
        {
          url: data.image,
        },
      ],
    },
    additionalMetaTags: [
      {
        property: "keywords",
        content: data.keyword,
      },
    ],
  };
}
