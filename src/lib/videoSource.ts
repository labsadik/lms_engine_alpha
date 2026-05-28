// src/lib/videoSource.ts

export type VideoProvider = "bunny" | "vdocipher" | null;

export interface DetectedVideo {
  provider: VideoProvider;
  id: string;
  embedUrl: string | null;
  thumbnail: string;
  isBunny: boolean;
}

export const BUNNY_LIBRARY_ID =
  import.meta.env.VITE_BUNNY_LIBRARY_ID || "671734";

export const BUNNY_CDN_HOSTNAME = (() => {
  const raw = import.meta.env.VITE_BUNNY_CDN_HOSTNAME || `vz-${BUNNY_LIBRARY_ID}.b-cdn.net`;
  if (raw.includes(".")) return raw;
  return `${raw}.b-cdn.net`;
})();

export function checkBunnyVideoExists(videoId: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!videoId) { resolve(false); return; }
    const img = new Image();
    const timeout = setTimeout(() => { img.onload = null; img.onerror = null; resolve(false); }, 6000);
    img.onload = () => { clearTimeout(timeout); resolve(true); };
    img.onerror = () => { clearTimeout(timeout); resolve(false); };
    img.src = `https://${BUNNY_CDN_HOSTNAME}/${videoId}/thumbnail.jpg`;
  });
}

export function detectVideo(
  rawId: string | null | undefined,
  kind: "recorded" | "live",
  provider: VideoProvider | undefined
): DetectedVideo {
  const id = (rawId || "").trim();
  if (!id) return { provider: null, id: "", embedUrl: null, thumbnail: "", isBunny: false };

  if (provider === "bunny") {
    return {
      provider: "bunny",
      id,
      embedUrl: `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${id}?autoplay=true&preload=true&responsive=true`,
      thumbnail: `https://${BUNNY_CDN_HOSTNAME}/${id}/thumbnail.jpg`,
      isBunny: true,
    };
  }

  if (provider === "vdocipher") {
    return { provider: "vdocipher", id, embedUrl: null, thumbnail: "", isBunny: false };
  }

  if (!provider) {
    if (kind === "live") return { provider: "vdocipher", id, embedUrl: null, thumbnail: "", isBunny: false };
    return {
      provider: "bunny", id,
      embedUrl: `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${id}?autoplay=true&preload=true&responsive=true`,
      thumbnail: `https://${BUNNY_CDN_HOSTNAME}/${id}/thumbnail.jpg`,
      isBunny: true,
    };
  }

  return { provider: null, id, embedUrl: null, thumbnail: "", isBunny: false };
}