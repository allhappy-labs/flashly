import { useEffect, useState } from "react";
import { File } from "expo-file-system";
import { APP_CAPABILITIES } from "../config/app-mode";
import { usableMediaUri } from "../utils/media-policy";

function isRemoteOrDataUri(uri: string) {
  return /^https?:\/\//i.test(uri) || /^data:/i.test(uri);
}

function isLocalFileUri(uri: string) {
  return /^file:\/\//i.test(uri);
}

export function useLocalFileAvailability(uri?: string | null) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const trimmed = usableMediaUri(uri, APP_CAPABILITIES.remoteMedia);
    if (!trimmed) {
      setAvailable(false);
      return;
    }
    if (isRemoteOrDataUri(trimmed)) {
      setAvailable(true);
      return;
    }
    if (!isLocalFileUri(trimmed)) {
      setAvailable(true);
      return;
    }
    try {
      const file = new File(trimmed);
      setAvailable(file.exists);
    } catch {
      setAvailable(false);
    }
  }, [uri]);

  return available;
}
