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
    <>
      <div className="flex flex-col gap-5 pb-10 bg-gray-100">
        {/* <HomeBanners />
        <ProductSearch />
        <HomeProducts /> */}

        {/* <HomeStreams /> */}
        {/* <HomeNews /> */}
      </div>
    </>
  );
}
