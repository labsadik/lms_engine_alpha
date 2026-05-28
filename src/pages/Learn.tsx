import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer from "@/components/VideoPlayer";
import GamifyChip from "@/components/GamifyChip";
import CommentUI from "@/components/CommentUI";
import LiveChat from "@/components/LiveChat";
import Notes from "@/components/Notes";
import { Button } from "@/components/ui/button";
import {
  Play, Clock, ChevronRight, ListChecks, Trophy,
  Lock, CheckCircle2, BookOpen, GraduationCap,
  ArrowLeft, MessageCircle, Heart, StickyNote, Radio,
  X, ChevronLeft, Circle,
} from "lucide-react";
import { completePart, awardWatchedMinute } from "@/lib/gamify";
import { useAuth } from "@/contexts/AuthContext";
import { useSEO } from "@/lib/seo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════ */
interface Course { id: string; title: string; [k: string]: unknown }
interface Part {
  id: string; name: string; video_id: string; kind: "recorded" | "live";
  notes_url: string | null; duration: string | null; position: number;
  is_preview: boolean; live_chat_enabled: boolean;
  video_provider: 'bunny' | 'vdocipher' | null;
}
interface Chapter { id: string; name: string; position: number; parts: Part[] }
interface Subject { id: string; name: string; position: number; chapters: Chapter[] }
interface TestItem { id: string; title: string; scope: string; subject_id: string | null; chapter_id: string | null; duration_minutes: number | null; }
interface ExtendedPart extends Part { chapterName: string; subjectName: string }
type ViewLevel = "subjects" | "chapters" | "lectures" | "player";
type PanelState = "none" | "comments" | "livechat";

const PALETTE = [
  { accent: "#3b82f6", light: "rgba(59,130,246,0.07)" }, { accent: "#8b5cf6", light: "rgba(139,92,246,0.07)" },
  { accent: "#10b981", light: "rgba(16,185,129,0.07)" }, { accent: "#f59e0b", light: "rgba(245,158,11,0.07)" },
  { accent: "#ef4444", light: "rgba(239,68,68,0.07)" }, { accent: "#06b6d4", light: "rgba(6,182,212,0.07)" },
];

function ProgressBar({ value, color }: { value: number; color?: string }) {
  return <div className="h-1 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color || "hsl(var(--primary))" }} /></div>;
}
function Skel({ className }: { className?: string }) { return <div className={cn("rounded-md bg-muted animate-pulse", className)} />; }
function ViewSkeleton() { return <div className="flex flex-col h-[100dvh]"><header className="shrink-0 flex items-center px-3 h-12 border-b border-border/40 bg-muted/30"><Skel className="w-9 h-9 rounded-lg" /><Skel className="w-28 h-7 rounded-lg ml-2" /></header><main className="flex-1 overflow-y-auto p-3 space-y-3"><div className="grid grid-cols-2 gap-2">{[0,1,2,3].map(i=><div key={i} className="rounded-xl border border-border/40 bg-card p-3 space-y-2"><Skel className="w-9 h-9 rounded-lg" /><Skel className="w-3/4 h-3.5" /></div>)}</div></main></div>; }

function Card({ name, items, done, total, color, onClick, locked, label, index }: { name: string; items: number; done: number; total: number; color: typeof PALETTE[0]; onClick: () => void; locked?: boolean; label: string; index: number; }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0; const isComplete = total > 0 && done === total;
  return (
    <button onClick={onClick} disabled={locked} className="group relative flex text-left rounded-xl border border-border/40 bg-card transition-all w-full outline-none active:scale-[0.98] hover:shadow-sm hover:bg-[var(--ch)]" style={{ "--ch": color.light } as React.CSSProperties}>
      {locked && <div className="absolute inset-0 rounded-xl bg-background/60 backdrop-blur-sm flex items-center justify-center z-10"><Lock className="w-4 h-4 text-muted-foreground" /></div>}
      <div className="flex items-start gap-2.5 p-3 w-full">
        <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color.accent}12` }}><span className="text-sm font-black tabular-nums" style={{ color: color.accent }}>{index + 1}</span></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5"><h3 className="font-bold text-xs sm:text-sm text-foreground line-clamp-2 leading-snug flex-1">{name}</h3>{isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}</div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5">{items} {label}</p>
          {total > 0 && (<><ProgressBar value={pct} color={isComplete ? "#22c55e" : color.accent} /><div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>{done}/{total}</span>{pct > 0 && <span className="font-bold" style={{ color: isComplete ? "#22c55e" : color.accent }}>{pct}%</span>}</div></>)}
        </div>
      </div>
    </button>
  );
}

function LectureItem({ part, active, done, locked, onClick, liked, onLike, idx }: { part: ExtendedPart; active: boolean; done: boolean; locked: boolean; onClick: () => void; liked: boolean; onLike: () => void; idx: number; }) {
  return (
    <div role={locked ? undefined : "button"} tabIndex={locked ? -1 : 0} onClick={locked ? undefined : onClick} className={cn("group flex items-center gap-2 px-2.5 sm:px-3 py-2.5 rounded-xl border transition-all text-left active:scale-[0.99] cursor-pointer", active && "bg-primary/5 border-primary/20", !active && !locked && "border-border/40 hover:bg-muted/20", locked && "opacity-40 cursor-not-allowed")}>
      <div className={cn("shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center", done && "bg-green-500 text-white", !done && active && "bg-primary text-primary-foreground", !done && !active && !locked && "bg-muted/50 text-muted-foreground/30 group-hover:bg-primary/10 group-hover:text-primary", locked && "bg-muted/20")}>
        {locked ? <Lock className="w-3 h-3" /> : done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3 h-3 ml-0.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1"><p className={cn("text-xs sm:text-sm font-semibold line-clamp-1", active ? "text-primary" : "text-foreground")}>{part.name}</p>
          {part.kind === "live" && (<span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-950/30 px-1 py-px rounded"><span className="relative flex h-1 w-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-1 w-1 bg-red-500" /></span>LIVE</span>)}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
          {part.duration && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{part.duration}</span>}
          {part.is_preview && !locked && <span className="text-primary/50 font-medium">Free</span>}
        </div>
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); onLike(); }} className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-muted/50"><Heart className={cn("w-3 h-3 sm:w-3.5 sm:h-3.5", liked ? "fill-red-500 text-red-500" : "text-muted-foreground/15")} /></button>
    </div>
  );
}

function TestCard({ test, done, variant = "default" }: { test: TestItem; done: boolean; variant?: "default" | "prominent" }) {
  if (variant === "prominent") {
    return (
      <a href={`/test/${test.id}`} className={cn("flex items-center gap-2.5 p-3 sm:p-4 rounded-xl border transition-all active:scale-[0.99]", done ? "border-green-400 dark:border-green-700 bg-green-50/80" : "border-primary bg-primary text-primary-foreground")}>
        <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0", done ? "bg-green-500 text-white" : "bg-white/15")}>
          {done ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("font-bold text-xs sm:text-sm truncate", done && "text-green-700")}>{done ? "Assessment Completed" : test.title}</p>
          {test.duration_minutes && <p className="text-[10px] sm:text-xs opacity-75 mt-0.5">{test.duration_minutes} min</p>}
        </div>
        <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
      </a>
    );
  }
  return (
    <a href={`/test/${test.id}`} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all active:scale-[0.99]", done ? "border-green-400 bg-green-50/80" : "border-amber-400 bg-amber-50/60")}>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", done ? "bg-green-500 text-white" : "bg-amber-100 text-amber-600")}>
        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ListChecks className="w-3.5 h-3.5" />}
      </div>
      <div className="min-w-0 flex-1"><p className={cn("font-semibold text-xs sm:text-sm truncate", done && "text-green-700")}>{test.title}</p></div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 shrink-0" />
    </a>
  );
}

function Breadcrumb({ items, onNavigate }: { items: { label: string; level: ViewLevel; icon: React.ReactNode }[]; onNavigate: (level: ViewLevel) => void }) {
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
      {items.map((item, i) => (
        <div key={i} className="flex items-center shrink-0">
          {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/20 mx-0.5" />}
          <button onClick={() => onNavigate(item.level)} className={cn("flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] sm:text-xs", i === items.length - 1 ? "text-foreground font-semibold bg-muted/50" : "text-muted-foreground hover:text-foreground")}>
            <span className="shrink-0 w-3 h-3 flex items-center justify-center">{item.icon}</span>
            <span className="truncate max-w-[50px] sm:max-w-[120px] lg:max-w-[200px]">{item.label}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════ */
export default function Learn() {
  const { slug } = useParams<{ slug: string }>(); 
  const { user } = useAuth(); 
  const navigate = useNavigate(); 
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [course, setCourse] = useState<Course | null>(null); 
  const [courseErr, setCourseErr] = useState(false);
  const [tree, setTree] = useState<Subject[]>([]); 
  const [tests, setTests] = useState<TestItem[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set()); 
  const [testCompletions, setTestCompletions] = useState<Set<string>>(new Set());
  const [enrolled, setEnrolled] = useState(false); 
  const [ready, setReady] = useState(false);
  
  const [view, setView] = useState<ViewLevel>("subjects"); 
  const [activeSubjectIdx, setActiveSubjectIdx] = useState<number | null>(null); 
  const [activeChapterIdx, setActiveChapterIdx] = useState<number | null>(null); 
  const [activePart, setActivePart] = useState<ExtendedPart | null>(null);
  
  const [likes, setLikes] = useState<Set<string>>(() => { 
    try { return new Set(JSON.parse(localStorage.getItem("lecture_likes") || "[]")); } catch { return new Set(); } 
  });
  
  const [mobilePanel, setMobilePanel] = useState<PanelState>("none"); 
  const [notesOpen, setNotesOpen] = useState(false); 
  const [notesData, setNotesData] = useState<{ url: string; title: string } | null>(null);
  
  const isPopRef = useRef(false); 
  const isRestoringRef = useRef(false); 
  const STORAGE_KEY = `learn_state_${slug}`;

  useSEO({ title: course ? `Learn: ${course.title}` : "Learning", description: "Continue your learning" });

  // Load Course (Resets state when slug changes!)
  useEffect(() => { 
    let alive = true; 
    setCourseErr(false);
    setReady(false);
    setView("subjects");
    setActiveSubjectIdx(null);
    setActiveChapterIdx(null);
    setActivePart(null);
    setMobilePanel("none");

    if (!slug) { setCourseErr(true); return; } 
    (async () => { 
      try { 
        const { data } = await supabase.from("courses").select("id,title,slug").eq("slug", slug).maybeSingle(); 
        if (!alive) return; 
        if (data) setCourse(data as Course); else setCourseErr(true); 
      } catch { if (alive) setCourseErr(true); } 
    })(); 
    return () => { alive = false; }; 
  }, [slug]);

  // Load Content Tree
  useEffect(() => {
    if (!course) return; let alive = true;
    (async () => {
      try {
        const [er, tr, tsr] = await Promise.all([
          user ? supabase.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", course.id).maybeSingle() : null,
          supabase.from("subjects").select(`id,name,position,chapters(id,name,position,parts(id,name,kind,video_id,notes_url,duration,position,is_preview,live_chat_enabled,video_provider))`).eq("course_id", course.id).order("position"),
          supabase.from("tests").select("id,title,scope,subject_id,chapter_id,duration_minutes").eq("course_id", course.id).eq("is_published", true),
        ]);
        if (!alive) return; if (er?.data) setEnrolled(true);
        setTree((tr.data || []).map((s: any) => ({ ...s, chapters: (s.chapters || []).sort((a: any, b: any) => a.position - b.position).map((c: any) => ({ ...c, parts: (c.parts || []).sort((a: any, b: any) => a.position - b.position).map((p: any) => ({ ...p, live_chat_enabled: p.live_chat_enabled ?? false, video_provider: p.video_provider ?? (p.kind === 'live' ? 'vdocipher' : 'bunny') })) })) })));
        setTests(tsr.data || []);
        if (user) {
          const [pr, ar] = await Promise.all([supabase.from("progress").select("part_id").eq("user_id", user.id).eq("completed", true), supabase.from("test_attempts").select("test_id,finished_at").eq("user_id", user.id)]);
          if (!alive) return; setCompleted(new Set((pr.data || []).map((p: any) => p.part_id))); const tc = new Set<string>(); ar.data?.forEach((a: any) => { if (a.finished_at) tc.add(a.test_id); }); setTestCompletions(tc);
        }
      } catch { toast.error("Failed to load"); } finally { if (alive) setReady(true); }
    })(); return () => { alive = false; };
  }, [course?.id, user?.id]);

  // Restore View State (Handles lectureId redirect properly)
  useEffect(() => { 
    if (!ready || tree.length === 0) return; 
    const lectureId = searchParams.get('lectureId'); 
    if (lectureId) { 
      let found = false;
      outerLoop: for (let sIdx = 0; sIdx < tree.length; sIdx++) { 
        const subj = tree[sIdx]; 
        for (let cIdx = 0; cIdx < subj.chapters.length; cIdx++) { 
          const chap = subj.chapters[cIdx]; 
          const part = chap.parts.find(p => p.id === lectureId); 
          if (part) { 
            isRestoringRef.current = true; setActiveSubjectIdx(sIdx); setActiveChapterIdx(cIdx); setActivePart({ ...part, chapterName: chap.name, subjectName: subj.name }); setView("player"); 
            found = true;
            break outerLoop; 
          } 
        } 
      } 
      // Clean up URL whether found or not
      searchParams.delete('lectureId'); setSearchParams(searchParams, { replace: true }); 
      if (found) {
        setTimeout(() => { isRestoringRef.current = false; }, 50); 
        return; // Stop here if we successfully restored from URL
      }
    } 
    // Fallback to session storage
    try { const raw = sessionStorage.getItem(STORAGE_KEY); if (!raw) return; const s = JSON.parse(raw); if (!s.view || s.view === "subjects") return; isRestoringRef.current = true; if (s.sIdx != null && tree[s.sIdx]) { setActiveSubjectIdx(s.sIdx); const subj = tree[s.sIdx]; if (s.cIdx != null && subj.chapters[s.cIdx]) { setActiveChapterIdx(s.cIdx); const ch = subj.chapters[s.cIdx]; if (s.pId) { const part = ch.parts.find((p: Part) => p.id === s.pId); if (part) setActivePart({ ...part, chapterName: ch.name, subjectName: subj.name }); } } } setView(s.view); setTimeout(() => { isRestoringRef.current = false; }, 50); } catch { isRestoringRef.current = false; } 
  }, [ready, tree, searchParams, setSearchParams]);

  useEffect(() => { if (!ready || isRestoringRef.current) return; try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ view, sIdx: activeSubjectIdx, cIdx: activeChapterIdx, pId: activePart?.id ?? null })); } catch {} }, [ready, view, activeSubjectIdx, activeChapterIdx, activePart?.id]);
  useEffect(() => { if (view !== "subjects" && !isPopRef.current && !isRestoringRef.current) window.history.pushState(null, ""); }, [view]);
  useEffect(() => { const onPop = () => { if (view !== "subjects") { isPopRef.current = true; goBack(); setTimeout(() => { isPopRef.current = false; }, 50); } }; window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, [view]);

  const activeSubject = activeSubjectIdx !== null ? tree[activeSubjectIdx] : null; 
  const activeChapter = activeSubject && activeChapterIdx !== null ? activeSubject.chapters[activeChapterIdx] : null;
  const breadcrumbs = useMemo(() => { 
    const items: { label: string; level: ViewLevel; icon: React.ReactNode }[] = [{ label: course?.title || "Course", level: "subjects", icon: <GraduationCap className="w-3 h-3" /> }]; 
    if (activeSubject) items.push({ label: activeSubject.name, level: "chapters", icon: <BookOpen className="w-3 h-3" /> }); 
    if (activeChapter) items.push({ label: activeChapter.name, level: "lectures", icon: <ListChecks className="w-3 h-3" /> }); 
    if (activePart) items.push({ label: activePart.name, level: "player", icon: <Play className="w-3 h-3" /> }); 
    return items; 
  }, [course, activeSubject, activeChapter, activePart]);
  
  const isSubjectLocked = useCallback((subj: Subject) => enrolled ? false : !subj.chapters.some((c) => c.parts.some((p) => p.is_preview)), [enrolled]);
  const isChapterLocked = useCallback((ch: Chapter) => enrolled ? false : !ch.parts.some((p) => p.is_preview), [enrolled]);
  const isPartLocked = useCallback((p: Part) => !enrolled && !p.is_preview, [enrolled]);
  const showLiveChat = activePart?.kind === "live" && activePart.live_chat_enabled;

  const navigateTo = useCallback((level: ViewLevel) => { if (level === "subjects") { setActiveSubjectIdx(null); setActiveChapterIdx(null); setActivePart(null); } else if (level === "chapters") { setActiveChapterIdx(null); setActivePart(null); } else if (level === "lectures") { setActivePart(null); } setView(level); setMobilePanel("none"); }, []);
  const goBack = useCallback(() => { if (view === "player") navigateTo("lectures"); else if (view === "lectures") navigateTo("chapters"); else if (view === "chapters") navigateTo("subjects"); else navigate(`/courses/${slug}`); }, [view, navigateTo, slug]);
  const openSubject = useCallback((idx: number) => { if (isSubjectLocked(tree[idx])) { toast.error("Enroll to unlock"); return; } setActiveSubjectIdx(idx); setActiveChapterIdx(null); setActivePart(null); setView("chapters"); }, [tree, isSubjectLocked]);
  const openChapter = useCallback((idx: number) => { if (!activeSubject || isChapterLocked(activeSubject.chapters[idx])) { toast.error("Enroll to unlock"); return; } setActiveChapterIdx(idx); setActivePart(null); setView("lectures"); }, [activeSubject, isChapterLocked]);
  const openLecture = useCallback((part: ExtendedPart) => { if (isPartLocked(part)) { toast.error("Enroll to unlock"); return; } setActivePart(part); setView("player"); setMobilePanel("none"); }, [isPartLocked]);
  const openNotes = useCallback((url: string, title: string) => { setNotesData({ url, title }); setNotesOpen(true); }, []);
  const toggleLike = useCallback((partId: string) => { setLikes((prev) => { const next = new Set(prev); if (next.has(partId)) next.delete(partId); else next.add(partId); localStorage.setItem("lecture_likes", JSON.stringify([...next])); return next; }); }, []);

  // ──── Gamification Logic ────
  const handleMinute = useCallback(async (min: number) => {
    if (!user || !activePart || !course) return;
    try { await awardWatchedMinute(user.id, activePart.id, min, course.id); } catch (e) { console.error(e); }
  }, [user, activePart, course]);

  const handleComplete = useCallback(async () => {
    if (!user || !activePart || !course || completed.has(activePart.id)) return;
    try {
      const result = await completePart(user.id, activePart.id, course.id);
      setCompleted((s) => new Set(s).add(activePart.id));
      if (result) {
        if (result.reward_xp > 0 || result.reward_coins > 0) {
          toast.success(`🎉 +${result.reward_xp} XP  🪙 +${result.reward_coins} Coins`, { duration: 4000 });
          if (result.current_streak > 1) {
            toast.info(`🔥 ${result.current_streak}-day streak!`, { duration: 3000 });
          }
        } else {
          toast.success("✅ Lecture completed!", { duration: 2000 });
        }
      } else {
        toast.success("✅ Lecture completed!", { duration: 2000 });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to complete");
    }
  }, [user, activePart, course, completed]);

  const toggleComplete = useCallback(async () => {
    if (!user || !activePart || !course) return; const isDone = completed.has(activePart.id);
    try { 
      if (isDone) { await supabase.from("progress").update({ completed: false, completed_at: null }).eq("user_id", user.id).eq("part_id", activePart.id); setCompleted((s) => { const n = new Set(s); n.delete(activePart.id); return n; }); }
      else { await handleComplete(); }
    } catch { toast.error("Failed to update"); }
  }, [user, activePart, course, completed, handleComplete]);

  const allLecturesFlat = useMemo(() => { if (!activeChapter) return []; return activeChapter.parts.map((p) => ({ ...p, chapterName: activeChapter.name, subjectName: activeSubject?.name || "" })); }, [activeChapter, activeSubject]);
  const currentLectureIdx = allLecturesFlat.findIndex((p) => p.id === activePart?.id); 
  const prevLecture = currentLectureIdx > 0 ? allLecturesFlat[currentLectureIdx - 1] : null; 
  const nextLecture = currentLectureIdx >= 0 && currentLectureIdx < allLecturesFlat.length - 1 ? allLecturesFlat[currentLectureIdx + 1] : null; 
  const isPartDone = activePart ? completed.has(activePart.id) : false;

  if (courseErr) return <div className="flex flex-col items-center justify-center h-[100dvh] gap-3 bg-background px-6 text-center"><BookOpen className="w-8 h-8 text-muted-foreground/30" /><h2 className="font-bold text-base">Course not found</h2><Button variant="outline" onClick={() => navigate("/courses")} className="mt-1 rounded-xl h-10 px-5 text-sm">Browse Courses</Button></div>;
  if (!course || !ready) return <ViewSkeleton />;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <header className="shrink-0 flex items-center gap-1.5 px-2 sm:px-3 h-11 sm:h-12 border-b border-border/40 bg-card z-30">
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-lg" onClick={goBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="min-w-0 flex-1 overflow-hidden"><Breadcrumb items={breadcrumbs} onNavigate={navigateTo} /></div>
        <div className="shrink-0 ml-1"><GamifyChip /></div>
      </header>

      <main className={cn("flex-1 min-h-0", view === "player" ? "flex flex-col lg:flex-row overflow-hidden" : "overflow-y-auto scroll-smooth")}>
        
        {/* ─── SUBJECTS VIEW ─── */}
        {view === "subjects" && (
          <div className="p-2.5 sm:p-4 lg:p-5 space-y-4">
            <h2 className="font-bold text-sm sm:text-lg">Subjects</h2>
            {tree.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {tree.map((subj, i) => { 
                  const parts = subj.chapters.flatMap((c) => c.parts); 
                  const done = parts.filter((p) => completed.has(p.id)).length; 
                  return <Card key={subj.id} name={subj.name} items={subj.chapters.length} done={done} total={parts.length} color={PALETTE[i % PALETTE.length]} onClick={() => openSubject(i)} locked={isSubjectLocked(subj)} label="chapters" index={i} />; 
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-xs">No subjects yet</div>
            )}
            {tests.filter(t => t.scope === 'course').length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="font-semibold text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <Trophy className="w-3 h-3 text-amber-500" />Assessment
                </h3>
                <div className="max-w-lg">
                  {tests.filter(t => t.scope === 'course').map(t => <TestCard key={t.id} test={t} done={testCompletions.has(t.id)} variant="prominent" />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── CHAPTERS VIEW ─── */}
        {view === "chapters" && activeSubject && (
          <div className="p-2.5 sm:p-4 lg:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${PALETTE[activeSubjectIdx! % PALETTE.length].accent}12` }}>
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: PALETTE[activeSubjectIdx! % PALETTE.length].accent }} />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-lg leading-tight">{activeSubject.name}</h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{activeSubject.chapters.length} chapters</p>
              </div>
            </div>
            {activeSubject.chapters.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {activeSubject.chapters.map((ch, i) => { 
                  const done = ch.parts.filter((p) => completed.has(p.id)).length; 
                  return <Card key={ch.id} name={ch.name} items={ch.parts.length} done={done} total={ch.parts.length} color={PALETTE[(activeSubjectIdx! + i + 1) % PALETTE.length]} onClick={() => openChapter(i)} locked={isChapterLocked(ch)} label="lectures" index={i} />; 
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-xs">No chapters yet</div>
            )}
            {tests.filter(t => t.scope === 'subject' && t.subject_id === activeSubject.id).length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="font-semibold text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <ListChecks className="w-3 h-3 text-amber-500" />Subject Test
                </h3>
                <div className="max-w-lg space-y-2">
                  {tests.filter(t => t.scope === 'subject' && t.subject_id === activeSubject.id).map(t => <TestCard key={t.id} test={t} done={testCompletions.has(t.id)} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── LECTURES VIEW ─── */}
        {view === "lectures" && activeChapter && (
          <div className="p-2.5 sm:p-4 lg:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${PALETTE[(activeSubjectIdx! + activeChapterIdx! + 1) % PALETTE.length].accent}12` }}>
                <ListChecks className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: PALETTE[(activeSubjectIdx! + activeChapterIdx! + 1) % PALETTE.length].accent }} />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-lg leading-tight">{activeChapter.name}</h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{activeChapter.parts.filter((p) => completed.has(p.id)).length}/{activeChapter.parts.length}</p>
              </div>
            </div>
            {activeChapter.parts.length > 0 ? (
              <div className="space-y-1.5">
                {activeChapter.parts.map((p, i) => { 
                  const ext: ExtendedPart = { ...p, chapterName: activeChapter.name, subjectName: activeSubject?.name || "" }; 
                  return <LectureItem key={p.id} part={ext} active={activePart?.id === p.id} done={completed.has(p.id)} locked={isPartLocked(p)} onClick={() => openLecture(ext)} liked={likes.has(p.id)} onLike={() => toggleLike(p.id)} idx={i} />; 
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-xs">No lectures yet</div>
            )}
            {tests.filter(t => t.scope === 'chapter' && t.chapter_id === activeChapter.id).length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="font-semibold text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <ListChecks className="w-3 h-3 text-amber-500" />Chapter Test
                </h3>
                <div className="max-w-lg space-y-2">
                  {tests.filter(t => t.scope === 'chapter' && t.chapter_id === activeChapter.id).map(t => <TestCard key={t.id} test={t} done={testCompletions.has(t.id)} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ PLAYER ══════ */}
        {view === "player" && activePart && (
          <>
            <div className="flex flex-col min-h-0 w-full lg:flex-1">
              <div className="shrink-0 relative w-full bg-black aspect-video lg:aspect-auto lg:flex-1 lg:min-h-0">
                <div className="absolute inset-0">
                  <VideoPlayer 
                    key={activePart.id} 
                    video={{ id: activePart.video_id, kind: activePart.kind, title: activePart.name, duration: activePart.duration ?? undefined, video_provider: activePart.video_provider ?? undefined }} 
                    onMinuteWatched={handleMinute}
                    onComplete={activePart.kind === "recorded" ? handleComplete : undefined} 
                  />
                </div>
                {activePart.kind === "live" && (<div className="absolute top-2 left-2 z-50 flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold"><span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" /></span>LIVE</div>)}
              </div>

              <div className="shrink-0 bg-card border-t border-border/40">
                <div className="px-2.5 sm:px-4 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">{activePart.name}</h2>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] sm:text-xs text-muted-foreground">
                        <span className="font-medium text-primary truncate max-w-[80px] sm:max-w-none">{activePart.subjectName}</span>
                        <span className="text-border/40">·</span>
                        <span className="truncate max-w-[60px] sm:max-w-none">{activePart.chapterName}</span>
                        {activePart.duration && (<><span className="text-border/40">·</span><Clock className="w-2.5 h-2.5" /><span>{activePart.duration}</span></>)}
                      </div>
                    </div>
                    <button onClick={toggleComplete} className={cn("shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all", isPartDone ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                      {isPartDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isPartDone ? "Done" : "Mark Done"}</span>
                    </button>
                  </div>
                </div>

                <div className="px-2.5 sm:px-4 pb-2 flex items-center gap-1">
                  <button onClick={() => toggleLike(activePart.id)} className={cn("h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg hover:bg-muted/50", likes.has(activePart.id) && "text-red-500")}><Heart className={cn("w-3.5 h-3.5", likes.has(activePart.id) && "fill-current")} /></button>
                  {activePart.notes_url && (<button onClick={() => openNotes(activePart.notes_url!, activePart.name)} className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg hover:bg-muted/50"><StickyNote className="w-3.5 h-3.5 text-muted-foreground/40" /></button>)}
                  {activePart.kind === "recorded" && (<button onClick={() => setMobilePanel(mobilePanel === "comments" ? "none" : "comments")} className={cn("h-7 px-2 sm:h-8 sm:px-2.5 flex items-center gap-1 rounded-lg text-[10px] sm:text-xs font-medium transition-all", mobilePanel === "comments" ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground")}><MessageCircle className="w-3.5 h-3.5" /><span className="hidden sm:inline">Doubts</span></button>)}
                  {showLiveChat && (<button onClick={() => setMobilePanel(mobilePanel === "livechat" ? "none" : "livechat")} className={cn("h-7 px-2 sm:h-8 sm:px-2.5 flex items-center gap-1 rounded-lg text-[10px] sm:text-xs font-medium transition-all", mobilePanel === "livechat" ? "bg-red-50 dark:bg-red-950/30 text-red-600" : "hover:bg-muted/50 text-muted-foreground")}><Radio className="w-3.5 h-3.5" /><span className="hidden sm:inline">Chat</span></button>)}
                  <div className="ml-auto flex items-center gap-1">
                    {prevLecture && (<button onClick={() => openLecture(prevLecture)} className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg hover:bg-muted/50"><ChevronLeft className="w-3.5 h-3.5" /></button>)}
                    {nextLecture && (<button onClick={() => openLecture(nextLecture)} className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"><ChevronRight className="w-3.5 h-3.5" /></button>)}
                  </div>
                </div>
              </div>

              {/* Mobile Panel */}
              {mobilePanel !== "none" && (
                <div className="flex lg:hidden flex-col flex-1 min-h-0 border-t border-border/40 bg-card overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                  <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/30">
                    <span className="font-semibold text-xs">{mobilePanel === "livechat" ? "Live Chat" : "Doubts & Discussion"}</span>
                    <button onClick={() => setMobilePanel("none")} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/50"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {mobilePanel === "livechat" && showLiveChat && <LiveChat partId={activePart.id} />}
                    {mobilePanel === "comments" && activePart.kind === "recorded" && <CommentUI partId={activePart.id} />}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Side Panel */}
            {mobilePanel !== "none" && (
              <div className="hidden lg:flex w-[360px] xl:w-[400px] shrink-0 border-l border-border/40 bg-card flex-col overflow-hidden animate-in slide-in-from-right-2 duration-200">
                <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border/30">
                  <span className="font-semibold text-sm">{mobilePanel === "livechat" ? "Live Chat" : "Doubts & Discussion"}</span>
                  <button onClick={() => setMobilePanel("none")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {mobilePanel === "livechat" && showLiveChat && <LiveChat partId={activePart.id} />}
                  {mobilePanel === "comments" && activePart.kind === "recorded" && <CommentUI partId={activePart.id} />}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Notes open={notesOpen} onClose={() => setNotesOpen(false)} url={notesData?.url || ""} title={notesData?.title || "Notes"} />
    </div>
  );
}