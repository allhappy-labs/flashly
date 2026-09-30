import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { APP_CAPABILITIES } from "../config/app-mode";
import { isRemoteMediaUri } from "../utils/media-policy";

type StoreDeckMediaInput = Readonly<{
  deckId: string;
  deckName: string;
  sourceUri: string;
  preferredName?: string;
}>;

const MEDIA_ROOT_NAME = "flashly-media";

function getMediaRoot() {
  return new Directory(Paths.document, MEDIA_ROOT_NAME);
}

function sanitizeSegment(value: string) {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-z0-9._-]+/gi, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "media";
}

function getFileNameFromUri(uri: string) {
  if (!uri || uri.startsWith("data:")) return null;
  const cleaned = uri.split("?")[0]?.split("#")[0] ?? "";
  const parts = cleaned.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function splitName(name: string) {
  const cleaned = name.replace(/[/\\]+/g, "_");
  const dotIndex = cleaned.lastIndexOf(".");
  if (dotIndex <= 0) return { base: cleaned, ext: "" };
  return { base: cleaned.slice(0, dotIndex), ext: cleaned.slice(dotIndex) };
}

function buildPreferredName(
  deckName: string,
  preferredName: string | undefined,
  fallbackExt: string,
  sourceUri: string
) {
  const deckSlug = sanitizeSegment(deckName || "deck");
  const baseName = preferredName ? sanitizeSegment(preferredName.split("/").pop() ?? preferredName) : null;
  const uriName = getFileNameFromUri(sourceUri);
  const rawName = baseName || (uriName ? sanitizeSegment(uriName) : `${deckSlug}-${Date.now()}`);
  const { base, ext } = splitName(rawName);
  const finalExt = ext || fallbackExt;
  return `${base || deckSlug}${finalExt}`;
}

function ensureDirectory(directory: Directory) {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
}

function buildUniqueTargetFile(directory: Directory, desiredName: string) {
  let target = new File(directory, desiredName);
  if (!target.exists) return target;
  const { base, ext } = splitName(desiredName);
  let counter = 1;
  while (counter < 200) {
    const nextName = `${base}-${counter}${ext}`;
    target = new File(directory, nextName);
    if (!target.exists) return target;
    counter += 1;
  }
  return new File(directory, `${base}-${Date.now()}${ext}`);
}

function getDataUriBase64(uri: string) {
  const match = uri.match(/^data:[a-z]+\/[a-z0-9+.-]+;base64,([A-Za-z0-9+/]+={0,2})$/i);
  return match?.[1] ?? null;
}

function isValidBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function getDataUriExtension(uri: string, fallbackExt: string) {
  const match = uri.match(/^data:([a-z]+)\/([a-z0-9+.-]+);base64,/i);
  if (!match) return fallbackExt;
  const subtype = match[2].toLowerCase();
  if (subtype === "jpeg") return ".jpg";
  if (subtype === "mpeg") return ".mp3";
  return `.${subtype.replace("x-", "")}`;
}

function isDataUri(uri: string) {
  return /^data:/i.test(uri);
}

function isLocalFileUri(uri: string) {
  return /^file:\/\//i.test(uri);
}

function canonicalFilePath(uri: string): string | null {
  if (!isLocalFileUri(uri)) return null;
  try {
    const url = new URL(uri);
    if (url.protocol.toLowerCase() !== "file:") return null;
    const decodedPath = decodeURIComponent(url.pathname).replace(/\\/g, "/");
    const segments: string[] = [];
    for (const segment of decodedPath.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        segments.pop();
        continue;
      }
      segments.push(segment);
    }
    return `file://${url.host}/${segments.join("/")}`;
  } catch {
    return null;
  }
}

function isManagedMediaUri(uri: string) {
  const rootPath = canonicalFilePath(getMediaRoot().uri);
  const candidatePath = canonicalFilePath(uri);
  if (!rootPath || !candidatePath) return false;
  return candidatePath.startsWith(`${rootPath}/`);
}

async function storeDeckMedia(
  input: StoreDeckMediaInput,
  folder: "images" | "audio",
  fallbackExt: string
) {
  const trimmed = input.sourceUri.trim();
  if (!trimmed) return "";
  if (isRemoteMediaUri(trimmed)) return APP_CAPABILITIES.remoteMedia ? trimmed : "";
  if (isManagedMediaUri(trimmed) && isLocalFileUri(trimmed)) return trimmed;

  const root = getMediaRoot();
  ensureDirectory(root);
  const deckDir = new Directory(root, `decks/${sanitizeSegment(input.deckId)}`);
  ensureDirectory(deckDir);
  const mediaDir = new Directory(deckDir, folder);
  ensureDirectory(mediaDir);

  const preferredName = buildPreferredName(input.deckName, input.preferredName, fallbackExt, trimmed);
  const targetFile = buildUniqueTargetFile(mediaDir, preferredName);

  if (isDataUri(trimmed)) {
    const base64 = getDataUriBase64(trimmed);
    if (!base64 || !isValidBase64(base64)) return "";
    const extension = getDataUriExtension(trimmed, fallbackExt);
    const withExt = targetFile.uri.endsWith(extension)
      ? targetFile
      : buildUniqueTargetFile(mediaDir, `${splitName(preferredName).base}${extension}`);
    try {
      withExt.create({ overwrite: true });
      withExt.write(base64, { encoding: "base64" });
      return withExt.exists ? withExt.uri : "";
    } catch {
      if (withExt.exists) withExt.delete();
      return "";
    }
  }

  if (Platform.OS === "web") {
    return trimmed;
  }

  const sourceFile = new File(trimmed);
  if (!sourceFile.exists) return "";
  try {
    await sourceFile.copy(targetFile);
    return targetFile.exists ? targetFile.uri : "";
  } catch {
    if (targetFile.exists) targetFile.delete();
    return "";
  }
}

export function getImageFileName(uri: string) {
  return getFileNameFromUri(uri);
}

export function getAudioFileName(uri: string) {
  return getFileNameFromUri(uri);
}

export async function storeDeckImage(input: StoreDeckMediaInput) {
  return storeDeckMedia(input, "images", ".jpg");
}

export async function storeDeckAudio(input: StoreDeckMediaInput) {
  return storeDeckMedia(input, "audio", ".mp3");
}

export function deleteDeckMedia(deckId: string) {
  const root = getMediaRoot();
  if (!root.exists) return;
  const deckDir = new Directory(root, `decks/${sanitizeSegment(deckId)}`);
  if (!deckDir.exists) return;
  deckDir.delete();
}

export function clearAllDeckMedia() {
  const root = getMediaRoot();
  if (!root.exists) return;
  root.delete();
}

export function deleteStoredMediaFiles(uris: string[]) {
  for (const uri of uris) {
    if (!isLocalFileUri(uri) || !isManagedMediaUri(uri)) continue;
    try {
      new File(uri).delete();
    } catch {
      // Rollback cleanup is best-effort; missing files are already clean.
    }
  }
}

export function deleteImageIfLocal(uri?: string | null) {
  if (!uri) return;
  if (!isLocalFileUri(uri) || !isManagedMediaUri(uri)) return;
  const file = new File(uri);
  if (!file.exists) return;
  file.delete();
}

export function deleteAudioIfLocal(uri?: string | null) {
  if (!uri) return;
  if (!isLocalFileUri(uri) || !isManagedMediaUri(uri)) return;
  const file = new File(uri);
  if (!file.exists) return;
  file.delete();
}
