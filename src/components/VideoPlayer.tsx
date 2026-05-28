// src/components/VideoPlayer.tsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Loader2, WifiOff } from "lucide-react";
import {
  detectVideo,
  checkBunnyVideoExists,
  type DetectedVideo,
} from "@/lib/videoSource";
import { supabase } from "@/integrations/supabase/client";

export interface PlayerVideo {
  id: string;
  title: string;
  kind: "recorded" | "live";
  duration?: string;
  video_provider: "bunny" | "vdocipher" | null;
}

interface VideoPlayerProps {
  video: PlayerVideo;
  onPlayed?: () => void;
  onComplete?: () => void;
  onProgress?: (pct: number) => void;
  onMinuteWatched?: (minute: number) => void;
}

const PLACEHOLDER_IMG =
  "https://d2bps9p1kiy4ka.cloudfront.net/5eb393ee95fab7468a79d189/069cb915-6eb4-4966-ace9-dff83dcdbccb.png";
const IFRAME_ALLOW =
  "autoplay; encrypted-media; fullscreen; picture-in-picture";

function parseDuration(d?: string | null): number {
  if (!d) return 0;
  const p = d.split(":").map((n) => parseInt(n, 10) || 0);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
}

export default function VideoPlayer({
  video,
  onPlayed,
  onComplete,
  onProgress,
  onMinuteWatched,
}: VideoPlayerProps) {
  const detected = useMemo<DetectedVideo>(
    () => detectVideo(video.id, video.kind, video.video_provider),
    [video.id, video.kind, video.video_provider]
  );

  const [status, setStatus] = useState<
    "checking" | "loading" | "playing" | "unavailable" | "error"
  >("checking");

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Tracking refs ──
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsWatchedRef = useRef(0);
  const minutesAwardedRef = useRef<Set<number>>(new Set());
  const completedFiredRef = useRef(false);
  const tabVisibleRef = useRef(true);
  const isPlayingRef = useRef(false);

  // ── Stable callback refs ──
  const onPlayedRef = useRef(onPlayed);
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  const onMinuteWatchedRef = useRef(onMinuteWatched);

  useEffect(() => { onPlayedRef.current = onPlayed; }, [onPlayed]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onMinuteWatchedRef.current = onMinuteWatched; }, [onMinuteWatched]);

  const totalDurationSec = useMemo(() => parseDuration(video.duration), [video.duration]);

  useEffect(() => {
    const handler = () => { tabVisibleRef.current = !document.hidden; };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // WATCH TRACKING TIMER
  // ─────────────────────────────────────────────────────────────
  const startTracking = useCallback(() => {
    if (timerRef.current) return;
    
    timerRef.current = setInterval(() => {
      if (!tabVisibleRef.current || !isPlayingRef.current) return;

      secondsWatchedRef.current += 1;
      const sec = secondsWatchedRef.current;

      // 1. Progress percentage (Recorded only)
      if (video.kind === "recorded" && totalDurationSec > 0) {
        const pct = Math.min(100, Math.round((sec / totalDurationSec) * 100));
        onProgressRef.current?.(pct);
      }

      // 2. Minute watched (Fires event to Learn.tsx for DB update)
      const currentMinute = Math.floor(sec / 60);
      if (currentMinute > 0 && !minutesAwardedRef.current.has(currentMinute)) {
        minutesAwardedRef.current.add(currentMinute);
        onMinuteWatchedRef.current?.(currentMinute); 
      }

      // 3. Auto-complete at 90% (Recorded only)
      if (
        video.kind === "recorded" &&
        totalDurationSec > 0 &&
        sec >= totalDurationSec * 0.9 &&
        !completedFiredRef.current
      ) {
        completedFiredRef.current = true;
        onCompleteRef.current?.();
      }
    }, 1000);
  }, [video.kind, totalDurationSec]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // EMBED IFRAME
  // ─────────────────────────────────────────────────────────────
  const embedIframe = useCallback(
    (src: string) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";

      const iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.setAttribute("allow", IFRAME_ALLOW);
      iframe.style.cssText =
        "width:100%;height:100%;border:none;position:absolute;top:0;left:0;";
      containerRef.current.appendChild(iframe);

      isPlayingRef.current = true;
      setStatus("playing");
      onPlayedRef.current?.();
      startTracking();
    },
    [startTracking]
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!detected.id) {
        if (!cancelled) setStatus("unavailable");
        return;
      }

      if (detected.provider === "bunny") {
        const exists = await checkBunnyVideoExists(detected.id);
        if (cancelled) return;
        if (exists && detected.embedUrl) { embedIframe(detected.embedUrl); } 
        else { setStatus("unavailable"); }
        return;
      }

      if (detected.provider === "vdocipher" && video.kind === "recorded") {
        if (!cancelled) setStatus("loading");
        try {
          const { data, error } = await supabase.functions.invoke("get-vdo-otp", { body: { videoId: video.id } });
          if (cancelled) return;
          if (error || !data?.otp || !data?.playbackInfo) { setStatus("unavailable"); return; }
          embedIframe(`https://player.vdocipher.com/v2/?otp=${data.otp}&playbackInfo=${data.playbackInfo}`);
        } catch { if (!cancelled) setStatus("unavailable"); }
        return;
      }

      if (detected.provider === "vdocipher" && video.kind === "live") {
        if (!cancelled) setStatus("loading");
        let token: string | null = null;
        try {
          const { data, error } = await supabase.functions.invoke("get-vdo-jwt", { body: { liveId: video.id } });
          if (!error && data?.jwt) token = data.jwt;
        } catch {}
        if (cancelled) return;
        const src = token ? `https://player.vdocipher.com/live-v2?liveId=${video.id}&token=${token}` : `https://player.vdocipher.com/live-v2?liveId=${video.id}`;
        embedIframe(src);
        return;
      }

      if (!cancelled) setStatus("unavailable");
    };

    init();
    return () => { cancelled = true; };
  }, [detected, video.id, video.kind, embedIframe]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden rounded-lg sm:rounded-xl shadow-2xl aspect-video">
      <div ref={containerRef} className="absolute inset-0 z-10" />
      
      {(status === "checking" || status === "loading") && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-900">
          <img src={PLACEHOLDER_IMG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="relative z-10 flex flex-col items-center gap-2 p-4">
            <Loader2 className="w-7 h-7 sm:w-10 sm:h-10 text-white animate-spin" />
            <p className="text-white/60 text-xs sm:text-sm">{status === "checking" ? "Checking video..." : "Loading stream..."}</p>
          </div>
        </div>
      )}
      
      {status === "unavailable" && (
        <div className="absolute inset-0 z-20">
          <img src={PLACEHOLDER_IMG} alt="Unavailable" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="text-center"><WifiOff className="w-8 h-8 text-white/60 mx-auto mb-2" /><p className="text-white/90 font-semibold text-xs">Video not available yet</p></div>
          </div>
        </div>
      )}
    </div>
  );
}