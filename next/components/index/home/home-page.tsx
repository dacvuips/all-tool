import { HomeActionCards } from "./components/home-action-cards";
import { HomeBestSeller } from "./components/home-best-seller";
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
      <HomeActionCards />
      <HomeBestSeller />
    </div>
  );
}
