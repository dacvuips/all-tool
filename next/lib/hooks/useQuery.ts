import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export function useQuery(field: string) {
  const router = useRouter();
  const [id, setId] = useState(null);
  useEffect(() => {
    if (router.query[field]) {
      setId(router.query[field]);
    } else {
      setId(null);
    }
  }, [router.query]);

  return id;
}
