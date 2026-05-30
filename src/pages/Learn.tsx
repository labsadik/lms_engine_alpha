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
  X, Circle, Video,
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
  { accent: "#3b82f6", light: "rgba(59,130,246,0.08)" }, { accent: "#8b5cf6", light: "rgba(139,92,246,0.08)" },
  { accent: "#10b981", light: "rgba(16,185,129,0.08)" }, { accent: "#f59e0b", light: "rgba(245,158,11,0.08)" },
  { accent: "#ef4444", light: "rgba(239,68,68,0.08)" }, { accent: "#06b6d4", light: "rgba(6,182,212,0.08)" },
];

function ProgressBar({ value, color }: { value: number; color?: string }) {
  return <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden"><div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color || "hsl(var(--primary))" }} /></div>;
}

function Skel({ className }: { className?: string }) { return <div className={cn("rounded-lg bg-muted/40 animate-pulse", className)} />; }

function ViewSkeleton() { 
  return (
    <div className="flex flex-col h-[100dvh]">
      <header className="shrink-0 flex items-center px-4 h-14 border-b border-border/30 bg-card">
        <Skel className="w-9 h-9 rounded-xl" />
        <Skel className="w-32 h-6 rounded-lg ml-3" />
      </header>
      <main className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="space-y-2">
          <Skel className="w-24 h-5" />
          <Skel className="w-48 h-4" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[0,1,2,3,4,5].map(i=><div key={i} className="rounded-xl border border-border/20 bg-card p-4 space-y-3"><Skel className="w-10 h-10 rounded-xl" /><Skel className="w-3/4 h-4" /><Skel className="w-1/2 h-3" /></div>)}
        </div>
      </main>
    </div>
  ); 
}

function Card({ name, items, done, total, color, onClick, locked, label, index }: { name: string; items: number; done: number; total: number; color: typeof PALETTE[0]; onClick: () => void; locked?: boolean; label: string; index: number; }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0; 
  const isComplete = total > 0 && done === total;
  
  return (
    <button 
      onClick={onClick} 
      disabled={locked} 
      className="group relative flex text-left rounded-xl border border-border/30 bg-card transition-all w-full outline-none active:scale-[0.98] hover:shadow-md hover:border-border/60 hover:-translate-y-0.5 duration-200"
    >
      {locked && <div className="absolute inset-0 rounded-xl bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10"><Lock className="w-4 h-4 text-muted-foreground/60" /></div>}
      <div className="flex items-start gap-3 p-3.5 sm:p-4 w-full">
        <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: color.light }}>
          <span className="text-sm font-black tabular-nums" style={{ color: color.accent }}>{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="font-semibold text-sm sm:text-base text-foreground line-clamp-2 leading-snug flex-1">{name}</h3>
            {isComplete && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mb-2">{items} {label}</p>
          {total > 0 && (
            <div className="space-y-1">
              <ProgressBar value={pct} color={isComplete ? "#22c55e" : color.accent} />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{done}/{total}</span>
                {pct > 0 && <span className="font-bold" style={{ color: isComplete ? "#22c55e" : color.accent }}>{pct}%</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function LectureItem({ part, active, done, locked, onClick, liked, onLike, idx }: { part: ExtendedPart; active: boolean; done: boolean; locked: boolean; onClick: () => void; liked: boolean; onLike: () => void; idx: number; }) {
  const isLive = part.kind === 'live';
  return (
    <div 
      role={locked ? undefined : "button"} 
      tabIndex={locked ? -1 : 0} 
      onClick={locked ? undefined : onClick} 
      className={cn(
        "group flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl border transition-all text-left cursor-pointer",
        active && "bg-primary/5 border-primary/30 shadow-sm",
        !active && !locked && "border-border/30 hover:bg-muted/30 hover:border-border/60",
        locked && "opacity-40 cursor-not-allowed"
      )}
    >
      <div className={cn(
        "shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors",
        done && "bg-green-500 text-white",
        !done && active && "bg-primary text-primary-foreground",
        !done && !active && !locked && "bg-muted/40 text-muted-foreground/40 group-hover:bg-primary/10 group-hover:text-primary",
        locked && "bg-muted/20"
      )}>
        {locked ? <Lock className="w-3.5 h-3.5" /> : done ? <CheckCircle2 className="w-4 h-4" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={cn("text-sm font-semibold line-clamp-1", active ? "text-primary" : "text-foreground")}>
            {part.name}
          </p>
          {isLive ? (
            <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-md">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" /></span>
              LIVE
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-md">
              <Video className="w-2.5 h-2.5" />
              REC
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
          {part.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{part.duration}</span>}
          {part.is_preview && !locked && <span className="text-primary/70 font-semibold bg-primary/5 px-1.5 py-0.5 rounded text-[10px]">Free</span>}
        </div>
      </div>
      
      <button 
        type="button" 
        onClick={(e) => { e.stopPropagation(); onLike(); }} 
        className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors"
      >
        <Heart className={cn("w-4 h-4 transition-colors", liked ? "fill-red-500 text-red-500" : "text-muted-foreground/20 group-hover:text-muted-foreground/50")} />
      </button>
    </div>
  );
}

function TestCard({ test, done, variant = "default" }: { test: TestItem; done: boolean; variant?: "default" | "prominent" }) {
  if (variant === "prominent") {
    return (
      <a href={`/test/${test.id}`} className={cn("flex items-center gap-3 p-3 sm:p-4 rounded-xl border transition-all active:scale-[0.99] hover:shadow-sm", done ? "border-green-400/50 dark:border-green-700/50 bg-green-50/50 dark:bg-green-950/20" : "border-primary/50 bg-primary text-primary-foreground")}>
        <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0", done ? "bg-green-500 text-white" : "bg-white/15")}>
          {done ? <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> : <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("font-bold text-sm sm:text-base truncate", done && "text-green-700 dark:text-green-400")}>{done ? "Assessment Completed!" : test.title}</p>
          {test.duration_minutes && <p className="text-[11px] sm:text-xs opacity-75 mt-1">{test.duration_minutes} min</p>}
        </div>
        <ChevronRight className="w-5 h-5 shrink-0 opacity-60" />
      </a>
    );
  }
  return (
    <a href={`/test/${test.id}`} className={cn("flex items-center gap-3 px-3 py-3 rounded-xl border transition-all active:scale-[0.99] hover:shadow-sm", done ? "border-green-400/50 bg-green-50/50 dark:bg-green-950/20" : "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20")}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", done ? "bg-green-500 text-white" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600")}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : <ListChecks className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1"><p className={cn("font-semibold text-sm truncate", done && "text-green-700 dark:text-green-400")}>{test.title}</p></div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
    </a>
  );
}

function Breadcrumb({ items, onNavigate }: { items: { label: string; level: ViewLevel; icon: React.ReactNode }[]; onNavigate: (level: ViewLevel) => void }) {
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
      {items.map((item, i) => (
        <div key={i} className="flex items-center shrink-0">
          {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/30 mx-1" />}
          <button 
            onClick={() => onNavigate(item.level)} 
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors",
              i === items.length - 1 ? "text-foreground bg-muted/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">{item.icon}</span>
            <span className="truncate max-w-[60px] sm:max-w-[140px] lg:max-w-[220px]">{item.label}</span>
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

  // Load Course
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

  // Restore View State
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
      searchParams.delete('lectureId'); setSearchParams(searchParams, { replace: true }); 
      if (found) {
        setTimeout(() => { isRestoringRef.current = false; }, 50); 
        return; 
      }
    } 
    try { const raw = sessionStorage.getItem(STORAGE_KEY); if (!raw) return; const s = JSON.parse(raw); if (!s.view || s.view === "subjects") return; isRestoringRef.current = true; if (s.sIdx != null && tree[s.sIdx]) { setActiveSubjectIdx(s.sIdx); const subj = tree[s.sIdx]; if (s.cIdx != null && subj.chapters[s.cIdx]) { setActiveChapterIdx(s.cIdx); const ch = subj.chapters[s.cIdx]; if (s.pId) { const part = ch.parts.find((p: Part) => p.id === s.pId); if (part) setActivePart({ ...part, chapterName: ch.name, subjectName: subj.name }); } } } setView(s.view); setTimeout(() => { isRestoringRef.current = false; }, 50); } catch { isRestoringRef.current = false; } 
  }, [ready, tree, searchParams, setSearchParams]);

  useEffect(() => { if (!ready || isRestoringRef.current) return; try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ view, sIdx: activeSubjectIdx, cIdx: activeChapterIdx, pId: activePart?.id ?? null })); } catch {} }, [ready, view, activeSubjectIdx, activeChapterIdx, activePart?.id]);
  useEffect(() => { if (view !== "subjects" && !isPopRef.current && !isRestoringRef.current) window.history.pushState(null, ""); }, [view]);
  useEffect(() => { const onPop = () => { if (view !== "subjects") { isPopRef.current = true; goBack(); setTimeout(() => { isPopRef.current = false; }, 50); } }; window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, [view]);

  const activeSubject = activeSubjectIdx !== null ? tree[activeSubjectIdx] : null; 
  const activeChapter = activeSubject && activeChapterIdx !== null ? activeSubject.chapters[activeChapterIdx] : null;
  const breadcrumbs = useMemo(() => { 
    const items: { label: string; level: ViewLevel; icon: React.ReactNode }[] = [{ label: course?.title || "Course", level: "subjects", icon: <GraduationCap className="w-3.5 h-3.5" /> }]; 
    if (activeSubject) items.push({ label: activeSubject.name, level: "chapters", icon: <BookOpen className="w-3.5 h-3.5" /> }); 
    if (activeChapter) items.push({ label: activeChapter.name, level: "lectures", icon: <ListChecks className="w-3.5 h-3.5" /> }); 
    if (activePart) items.push({ label: activePart.name, level: "player", icon: <Play className="w-3.5 h-3.5" /> }); 
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
          if (result.current_streak > 1) toast.info(`🔥 ${result.current_streak}-day streak!`, { duration: 3000 });
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

  const isPartDone = activePart ? completed.has(activePart.id) : false;

  if (courseErr) return <div className="flex flex-col items-center justify-center h-[100dvh] gap-4 bg-background px-6 text-center"><div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center"><BookOpen className="w-8 h-8 text-muted-foreground/40" /></div><h2 className="font-bold text-lg">Course not found</h2><Button variant="outline" onClick={() => navigate("/courses")} className="mt-2 rounded-xl h-11 px-6">Browse Courses</Button></div>;
  if (!course || !ready) return <ViewSkeleton />;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-2 px-3 sm:px-4 h-14 border-b border-border/30 bg-card/80 backdrop-blur-lg z-30 sticky top-0">
        <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-xl hover:bg-muted/50" onClick={goBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="min-w-0 flex-1 overflow-hidden"><Breadcrumb items={breadcrumbs} onNavigate={navigateTo} /></div>
        <div className="shrink-0 ml-2"><GamifyChip /></div>
      </header>

      <main className={cn("flex-1 min-h-0", view === "player" ? "flex flex-col lg:flex-row overflow-hidden" : "overflow-y-auto scroll-smooth")}>
        
        {/* ─── SUBJECTS VIEW ─── */}
        {view === "subjects" && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
            <div>
              <h2 className="font-bold text-lg sm:text-xl text-foreground">Subjects</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Select a subject to continue learning</p>
            </div>
            {tree.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {tree.map((subj, i) => { 
                  const parts = subj.chapters.flatMap((c) => c.parts); 
                  const done = parts.filter((p) => completed.has(p.id)).length; 
                  return <Card key={subj.id} name={subj.name} items={subj.chapters.length} done={done} total={parts.length} color={PALETTE[i % PALETTE.length]} onClick={() => openSubject(i)} locked={isSubjectLocked(subj)} label="chapters" index={i} />; 
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground text-sm">No subjects available yet</div>
            )}
            {tests.filter(t => t.scope === 'course').length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                  <Trophy className="w-4 h-4 text-amber-500" />Course Assessment
                </h3>
                <div className="max-w-xl">
                  {tests.filter(t => t.scope === 'course').map(t => <TestCard key={t.id} test={t} done={testCompletions.has(t.id)} variant="prominent" />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── CHAPTERS VIEW ─── */}
        {view === "chapters" && activeSubject && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: PALETTE[activeSubjectIdx! % PALETTE.length].light }}>
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: PALETTE[activeSubjectIdx! % PALETTE.length].accent }} />
              </div>
              <div>
                <h2 className="font-bold text-lg sm:text-xl text-foreground leading-tight">{activeSubject.name}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{activeSubject.chapters.length} chapters · Choose a chapter to see lectures</p>
              </div>
            </div>
            {activeSubject.chapters.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {activeSubject.chapters.map((ch, i) => { 
                  const done = ch.parts.filter((p) => completed.has(p.id)).length; 
                  return <Card key={ch.id} name={ch.name} items={ch.parts.length} done={done} total={ch.parts.length} color={PALETTE[(activeSubjectIdx! + i + 1) % PALETTE.length]} onClick={() => openChapter(i)} locked={isChapterLocked(ch)} label="lectures" index={i} />; 
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground text-sm">No chapters available yet</div>
            )}
            {tests.filter(t => t.scope === 'subject' && t.subject_id === activeSubject.id).length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                  <ListChecks className="w-4 h-4 text-amber-500" />Subject Test
                </h3>
                <div className="max-w-xl space-y-2">
                  {tests.filter(t => t.scope === 'subject' && t.subject_id === activeSubject.id).map(t => <TestCard key={t.id} test={t} done={testCompletions.has(t.id)} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── LECTURES VIEW ─── */}
        {view === "lectures" && activeChapter && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: PALETTE[(activeSubjectIdx! + activeChapterIdx! + 1) % PALETTE.length].light }}>
                <ListChecks className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: PALETTE[(activeSubjectIdx! + activeChapterIdx! + 1) % PALETTE.length].accent }} />
              </div>
              <div>
                <h2 className="font-bold text-lg sm:text-xl text-foreground leading-tight">{activeChapter.name}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{activeChapter.parts.filter((p) => completed.has(p.id)).length}/{activeChapter.parts.length} completed</p>
              </div>
            </div>
            {activeChapter.parts.length > 0 ? (
              <div className="space-y-2">
                {activeChapter.parts.map((p, i) => { 
                  const ext: ExtendedPart = { ...p, chapterName: activeChapter.name, subjectName: activeSubject?.name || "" }; 
                  return <LectureItem key={p.id} part={ext} active={activePart?.id === p.id} done={completed.has(p.id)} locked={isPartLocked(p)} onClick={() => openLecture(ext)} liked={likes.has(p.id)} onLike={() => toggleLike(p.id)} idx={i} />; 
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground text-sm">No lectures available yet</div>
            )}
            {tests.filter(t => t.scope === 'chapter' && t.chapter_id === activeChapter.id).length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                  <ListChecks className="w-4 h-4 text-amber-500" />Chapter Test
                </h3>
                <div className="max-w-xl space-y-2">
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
                {activePart.kind === "live" && (
                  <div className="absolute top-3 left-3 z-50 flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-lg">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-white" /></span>
                    LIVE
                  </div>
                )}
              </div>

              <div className="shrink-0 bg-card border-t border-border/30">
                <div className="px-4 sm:px-5 py-3 sm:py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm sm:text-base font-bold text-foreground line-clamp-2 sm:line-clamp-1">{activePart.name}</h2>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] sm:text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium text-primary truncate max-w-[100px] sm:max-w-none">{activePart.subjectName}</span>
                        <span className="text-border/40">·</span>
                        <span className="truncate max-w-[80px] sm:max-w-none">{activePart.chapterName}</span>
                        {activePart.duration && (<><span className="text-border/40">·</span><Clock className="w-3 h-3" /><span>{activePart.duration}</span></>)}
                      </div>
                    </div>
                    <button 
                      onClick={toggleComplete} 
                      className={cn(
                        "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all border",
                        isPartDone ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border-transparent"
                      )}
                    >
                      {isPartDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isPartDone ? "Done" : "Mark Done"}</span>
                    </button>
                  </div>
                </div>

                <div className="px-4 sm:px-5 pb-3 sm:pb-4 flex items-center gap-2 flex-wrap">
                  <button onClick={() => toggleLike(activePart.id)} className={cn("h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted/50 transition-colors", likes.has(activePart.id) && "text-red-500")}><Heart className={cn("w-4 h-4", likes.has(activePart.id) && "fill-current")} /></button>
                  {activePart.notes_url && (<button onClick={() => openNotes(activePart.notes_url!, activePart.name)} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted/50 transition-colors"><StickyNote className="w-4 h-4 text-muted-foreground/50" /></button>)}
                  {activePart.kind === "recorded" && (<button onClick={() => setMobilePanel(mobilePanel === "comments" ? "none" : "comments")} className={cn("h-9 px-3 flex items-center gap-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition-all border", mobilePanel === "comments" ? "bg-primary/5 text-primary border-primary/20" : "hover:bg-muted/50 text-muted-foreground border-transparent")}><MessageCircle className="w-4 h-4" /><span className="hidden sm:inline">Doubts</span></button>)}
                  {showLiveChat && (<button onClick={() => setMobilePanel(mobilePanel === "livechat" ? "none" : "livechat")} className={cn("h-9 px-3 flex items-center gap-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition-all border", mobilePanel === "livechat" ? "bg-red-50 dark:bg-red-950/30 text-red-600 border-red-200 dark:border-red-800" : "hover:bg-muted/50 text-muted-foreground border-transparent")}><Radio className="w-4 h-4" /><span className="hidden sm:inline">Chat</span></button>)}
                </div>
              </div>

              {/* Mobile Panel */}
              {mobilePanel !== "none" && (
                <div className="flex lg:hidden flex-col flex-1 min-h-0 border-t border-border/30 bg-card overflow-hidden animate-in slide-in-from-bottom-4 duration-300" style={{ maxHeight: '50dvh' }}>
                  <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border/20 bg-muted/20">
                    <span className="font-semibold text-sm">{mobilePanel === "livechat" ? "Live Chat" : "Doubts & Discussion"}</span>
                    <button onClick={() => setMobilePanel("none")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50"><X className="w-4 h-4" /></button>
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
              <div className="hidden lg:flex w-[380px] xl:w-[420px] shrink-0 border-l border-border/30 bg-card flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
                <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border/20 bg-muted/20">
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