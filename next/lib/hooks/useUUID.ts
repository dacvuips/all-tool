import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export const useUUID = () => {
  const [id, setId] = useState<string>(null);

  useEffect(() => {
    setId(uuidv4());
  }, []);

  return id;
};

export const getUUID = () => uuidv4();
