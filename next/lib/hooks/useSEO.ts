export function useSEO(
  title: string,
  data: { description?: string; image?: string; keyword?: string; shopName?: string } = {}
) {
  return {
    titleTemplate: data.shopName ? `%s | ${data.shopName}` : `%s`,
    defaultTitle: `${data.shopName}`,
    title,
    description: data.description,
    image: data.image,
    openGraph: {
      type: "website",
      locale: "vi_VN",
      site_name: "Viet Theo Veo 3 - Free Generate Video AI - Image AI",
      title,
      description: data.description,
      images: [
        {
          url: data.image,
          alt: data.shopName,
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
