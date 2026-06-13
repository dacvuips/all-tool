import { HomeBanners } from "./components/home-banners";
import { HomeHero } from "./components/home-hero";
import { HomeProvider } from "./provider/home-provider";

export function HomePage() {
  return (
    <HomeProvider>
      <HomeComponent />
    </HomeProvider>
  );
}

function HomeComponent() {
  return (
    <div className="bg-gray-100">
      <HomeHero />
      <HomeBanners />

      {/* <HomeActionCards /> */}
      {/* <HomeBestSeller /> */}
    </div>
  );
}
