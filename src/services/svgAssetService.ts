import * as FileSystem from "expo-file-system/legacy";

const xmlCache = new Map<string, Promise<string>>();

// Android release assets can be resource names (no URI scheme), not fetch URLs.
export function loadSvgAssetXml(uri: string): Promise<string> {
  const cached = xmlCache.get(uri);
  if (cached) return cached;
  const pending = (/^https?:\/\//i.test(uri)
    ? fetch(uri).then(async response => {
        if (!response.ok) throw new Error(`Unable to load background (${response.status}).`);
        return response.text();
      })
    : FileSystem.readAsStringAsync(uri))
    .catch(error => {
      xmlCache.delete(uri);
      throw error;
    });
  xmlCache.set(uri, pending);
  return pending;
}
