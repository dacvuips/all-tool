import { HomeApiPromo } from "./components/home-api-promo";
import { HomeBanners } from "./components/home-banners";
import { HomeApiMediaConsole } from "./components/home-console/home-api-media-console";
import { HomeFilmPreview } from "./components/home-film-preview";
import { HomeFilmPromo } from "./components/home-film-promo";
import { HomeHero } from "./components/home-hero";
import {
  HOME_COL_MEDIA_LEFT_WIDE,
  HOME_COL_MEDIA_RIGHT,
  HOME_COL_MEDIA_RIGHT_WIDE,
  HOME_COL_TEXT_LEFT,
  HOME_COL_TEXT_LEFT_NARROW,
  HOME_COL_TEXT_RIGHT,
  HOME_SECTION_ROW,
  HOME_SECTION_ROW_API,
} from "./components/home-layout";
import { HomeProvider } from "./provider/home-provider";

export function HomePage() {
  return (
    <HomeProvider>
      <HomeComponent />
    </HomeProvider>
  );
}

const sectionBackground = (
  <>
    <div
      className="absolute inset-0 opacity-30 pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 30% -10%, rgba(242, 137, 13, 0.15) 0%, transparent 60%)",
      }}
    />
    <div
      className="absolute inset-0 opacity-5 pointer-events-none"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }}
    />
  </>
);

function HomeComponent() {
  return (
    <div className="bg-gray-100">
      <section className={`${HOME_SECTION_ROW} bg-white`}>
        {sectionBackground}
        <div className={HOME_COL_TEXT_LEFT}>
          <HomeHero />
        </div>
        <div className={HOME_COL_MEDIA_RIGHT}>
          <HomeBanners />
        </div>
      </section>

      <section className={`${HOME_SECTION_ROW_API} bg-white`}>
        {sectionBackground}
        <div className={HOME_COL_MEDIA_LEFT_WIDE}>
          <HomeApiMediaConsole embedded />
        </div>
        <div className={HOME_COL_TEXT_RIGHT}>
          <HomeApiPromo />
        </div>
      </section>

      <section className={`${HOME_SECTION_ROW_API} bg-white`}>
        {sectionBackground}
        <div className={HOME_COL_TEXT_LEFT_NARROW}>
          <HomeFilmPromo />
        </div>
        <div className={HOME_COL_MEDIA_RIGHT_WIDE}>
          <HomeFilmPreview />
        </div>
      </section>

      {/* <HomeActionCards /> */}
      {/* <HomeBestSeller /> */}
    </div>
  );
}
