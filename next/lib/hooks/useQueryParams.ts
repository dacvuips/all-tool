import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export type QueryParams<T extends string> = Partial<
  Record<T, string | number | symbol | undefined>
>;

export function useQueryParams<T extends string>(
  defaultValue: QueryParams<T> = {},
  internal?: boolean
): [QueryParams<T>, (value: QueryParams<T>, newPathname?: string) => void] {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const getInitValue = () => {
    const initValue = { ...defaultValue };
    for (const key in initValue) {
      initValue[key] = decodeURIComponent(searchParams.get(key) || "") || initValue[key];
    }

    return initValue;
  };

  const [query, setQuery] = useState(getInitValue());

  const updateUrl = (newVal: QueryParams<T>, newPathname: string) => {
    const newQuery = { ...query, ...newVal };

    setQuery(newQuery);
    const decodedString = decodeURIComponent(searchParams.toString());

    const params = new URLSearchParams(decodedString);

    Object.keys(newQuery).forEach((key) => {
      const value = String(newQuery[key as T]);
      if (value.trim() === "") {
        params.delete(key);
      } else {
        params.set(key, decodeURIComponent(value));
      }
    });

    router.replace({
      pathname: `${newPathname || pathname}`,
      search: params.toString(),
    });
  };

  useEffect(() => {
    if (internal) return;

    setQuery(getInitValue());
  }, [searchParams, internal]);

  return [query, updateUrl];
}
