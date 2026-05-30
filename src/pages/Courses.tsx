import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, BookOpen, Search, X,
  ArrowDownWideNarrow, ArrowUpWideNarrow, ArrowRight, Flame, Zap,
} from 'lucide-react';
import { formatPriceINR } from '@/lib/format';
import { useSEO } from '@/lib/seo';
import { useCachedData } from '@/hooks/useCachedData';
import { cn } from '@/lib/utils';

/* ────────────── types ────────────── */
interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  instructor: string | null;
  price_inr: number;
  created_at: string;
}

interface SubjectRow {
  course_id: string;
  name: string;
}

/* ────────────── helpers ────────────── */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};
const COURSE_DISCOUNTS = [15, 25, 33, 40, 47, 55, 59, 63];
const getYearlyCourseDiscount = (courseId: string): number => {
  const year = new Date().getFullYear();
  const seed = hashString(`${courseId}-${year}`);
  return COURSE_DISCOUNTS[seed % COURSE_DISCOUNTS.length];
};
const getOriginalPrice = (actualPrice: number, discountPercent: number): number => {
  if (actualPrice <= 0 || discountPercent <= 0) return 0;
  const raw = actualPrice / (1 - discountPercent / 100);
  return Math.ceil(raw / 100) * 100;
};
const getClaimedPercentage = (courseId: string): number => {
  const currentMonth = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const seed = hashString(`${courseId}-claim-${year}`);
  const baseProgress = 7 + currentMonth * 5;
  const offset = seed % 11;
  return Math.min(85, baseProgress + offset);
};
const DEAL_DURATIONS_MONTHS = [4, 6, 8, 10, 12];
const getCourseDeadline = (courseId: string): Date => {
  const now = new Date();
  const year = now.getFullYear();
  const seed = hashString(`${courseId}-deadline-${year}`);
  const monthsToAdd = DEAL_DURATIONS_MONTHS[seed % DEAL_DURATIONS_MONTHS.length];
  let deadline = new Date(year, 0 + monthsToAdd, 1, 0, 0, 0);
  const dayOffset = (seed * 3) % 28;
  const hourOffset = (seed * 5) % 24;
  deadline.setDate(deadline.getDate() + dayOffset);
  deadline.setHours(hourOffset);
  if (deadline.getTime() <= now.getTime()) {
    deadline.setFullYear(deadline.getFullYear() + 1);
  }
  return deadline;
};

/* ────────────── Cache normalization ────────────── */
function normalizeCachedCourses(raw: unknown): Course[] {
  if (Array.isArray(raw)) return raw;
  if (raw == null || typeof raw !== 'object') return [];
  if ('data' in raw) {
    const inner = (raw as Record<string, unknown>).data;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

function normalizeCachedSubjects(raw: unknown): SubjectRow[] {
  if (Array.isArray(raw)) return raw;
  if (raw == null || typeof raw !== 'object') return [];
  if ('data' in raw) {
    const inner = (raw as Record<string, unknown>).data;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

/* ────────────── skeleton ────────────── */
function CourseSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/20 bg-card">
      <div className="relative aspect-video shimmer-overlay bg-muted" />
      <div className="flex flex-1 flex-col p-5 gap-3">
        <div className="h-5 w-4/5 rounded-lg shimmer-overlay bg-muted" />
        <div className="h-4 w-1/2 rounded-lg shimmer-overlay bg-muted" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-full rounded-lg shimmer-overlay bg-muted" />
          <div className="h-3 w-5/6 rounded-lg shimmer-overlay bg-muted" />
          <div className="h-3 w-2/3 rounded-lg shimmer-overlay bg-muted" />
        </div>
        <div className="mt-auto space-y-3 pt-3 border-t border-border/10">
           <div className="h-10 w-full rounded-xl shimmer-overlay bg-muted" />
           <div className="flex items-center justify-between">
             <div className="h-6 w-24 rounded-lg shimmer-overlay bg-muted" />
             <div className="h-4 w-12 rounded-lg shimmer-overlay bg-muted" />
           </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────── RevealCard ────────────── */
function RevealCard({ children, index }: { children: React.ReactNode; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShow(true);
          io.unobserve(el);
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px -30px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.97)',
        transition: `opacity .5s cubic-bezier(.22,1,.36,1) ${Math.min(index * 0.06, 0.36)}s, transform .5s cubic-bezier(.22,1,.36,1) ${Math.min(index * 0.06, 0.36)}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ────────────── CourseCard ────────────── */
function CourseCard({ c }: { c: Course }) {
  const [timeLeft, setTimeLeft] = useState({ d: 0, m: 0, s: 0 });
  const discountPercent = c.price_inr > 0 ? getYearlyCourseDiscount(c.id) : 0;
  const originalPrice = discountPercent > 0 ? getOriginalPrice(c.price_inr, discountPercent) : 0;
  const claimedPercent = discountPercent > 0 ? getClaimedPercentage(c.id) : 0;

  useEffect(() => {
    if (discountPercent <= 0) return;
    const deadline = getCourseDeadline(c.id);
    const calculateTimeLeft = () => {
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();
      if (diff <= 0) return { d: 0, m: 0, s: 0 };
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const m = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      return { d, m, s };
    };
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [c.id, discountPercent]);

  return (
    <Link to={`/courses/${c.slug}`} className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl">
      <Card className="flex h-full flex-col overflow-hidden border-border/30 bg-card transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/[0.04] rounded-2xl">
        <div className="relative aspect-video overflow-hidden bg-muted/50">
          {c.thumbnail_url ? (
            <img
              src={c.thumbnail_url}
              alt={c.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground/30">
              <BookOpen className="h-12 w-12" />
            </div>
          )}
          
          {/* Discount Badge (Subject tags removed as requested) */}
          {discountPercent > 0 && (
            <div className="absolute right-2.5 top-2.5 z-10">
              <span className="discount-glow inline-flex items-center gap-1 bg-red-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-lg">
                <Flame className="w-3 h-3" /> {discountPercent}% OFF
              </span>
            </div>
          )}

          <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/40 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="flex h-9 w-9 translate-x-2 translate-y-2 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug transition-colors group-hover:text-primary sm:text-base">
            {c.title}
          </h3>
          {c.instructor && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {c.instructor.charAt(0).toUpperCase()}
              </span>
              <span className="truncate font-medium">{c.instructor}</span>
            </p>
          )}

          {/* Description made more prominent and readable */}
          {c.description && (
            <p className="mt-3 flex-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground/90">
              {c.description}
            </p>
          )}

          {discountPercent > 0 ? (
            <div className="mt-auto space-y-3 pt-4">
              <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-red-500 to-orange-500 rounded-xl p-3 text-white shadow-inner">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Flash Deal</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-sm font-extrabold tabular-nums tracking-tight">
                    <span className="bg-black/20 rounded-md px-1.5 py-0.5 flex items-center justify-center min-w-[28px]">
                      {String(timeLeft.d).padStart(2, '0')}<span className="text-[8px] ml-0.5 opacity-70">D</span>
                    </span>
                    <span className="tick-colon text-white/80">:</span>
                    <span className="bg-black/20 rounded-md px-1.5 py-0.5 flex items-center justify-center min-w-[28px]">
                      {String(timeLeft.m).padStart(2, '0')}<span className="text-[8px] ml-0.5 opacity-70">M</span>
                    </span>
                    <span className="tick-colon text-white/80">:</span>
                    <span className="bg-black/20 rounded-md px-1.5 py-0.5 flex items-center justify-center min-w-[28px]">
                      {String(timeLeft.s).padStart(2, '0')}<span className="text-[8px] ml-0.5 opacity-70">S</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-semibold">
                  <span className="text-red-500 flex items-center gap-0.5"><Zap className="w-3 h-3" /> Selling Fast</span>
                  <span className="text-muted-foreground">{claimedPercent}% Claimed</span>
                </div>
                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-500 to-orange-400 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${claimedPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-primary">{formatPriceINR(c.price_inr)}</span>
                  <span className="text-sm text-muted-foreground line-through decoration-red-400/60 decoration-2">{formatPriceINR(originalPrice)}</span>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-primary">
                  View →
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-auto flex items-center justify-between border-t border-border/30 pt-4 mt-4">
              <span className="text-lg font-extrabold tracking-tight text-primary">
                {c.price_inr === 0 ? (
                  <span className="text-emerald-500 inline-flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg text-sm font-bold">
                    <Zap className="w-3.5 h-3.5" /> Free
                  </span>
                ) : (
                  formatPriceINR(c.price_inr)
                )}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-primary">
                View →
              </span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

/* ════════════════════════════════════════════════════════════════ */

// ─── Exact Cache Keys Requested ───
const COURSES_CACHE_KEY = 'courses:list';
const SUBJECTS_CACHE_KEY = 'subjects:map';

const Courses = () => {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const searchRef = useRef<HTMLInputElement>(null);

  useSEO({
    title: 'All Courses — LearnHub',
    description: 'Browse all available courses on LearnHub. Physics, Chemistry, Math, and more for JEE/NEET preparation.',
  });

  /* ─── 1. Fetch Courses (stable reference) ─── */
  const fetchCourses = useCallback(async (): Promise<Course[]> => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, slug, title, description, thumbnail_url, instructor, price_inr, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Courses] Supabase fetch error:', error);
      throw error;
    }
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'data' in data) {
      const inner = (data as Record<string, unknown>).data;
      return Array.isArray(inner) ? inner : [];
    }
    return [];
  }, []);

  const { data: rawCourses, loading: cLoading } = useCachedData<Course[]>(COURSES_CACHE_KEY, fetchCourses, []);

  /* ─── 2. Normalize courses from cache ─── */
  const safeCourses = useMemo<Course[]>(() => normalizeCachedCourses(rawCourses), [rawCourses]);

  /* ─── 3. Stable course-IDs string for subjects deps ─── */
  const courseIdsString = useMemo(() => {
    if (safeCourses.length === 0) return '__empty__';
    return safeCourses.map((c) => c.id).sort().join(',');
  }, [safeCourses]);

  /* ─── 4. Fetch Subjects (stable reference, keyed by course IDs) ─── */
  const safeCoursesRef = useRef(safeCourses);
  useEffect(() => { safeCoursesRef.current = safeCourses; }, [safeCourses]);

  const fetchSubjects = useCallback(async (): Promise<SubjectRow[]> => {
    const ids = safeCoursesRef.current.map((c) => c.id);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from('subjects')
      .select('course_id, name')
      .in('course_id', ids);

    if (error) {
      console.error('[Subjects] Supabase fetch error:', error);
      return [];
    }
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'data' in data) {
      const inner = (data as Record<string, unknown>).data;
      return Array.isArray(inner) ? inner : [];
    }
    return [];
  }, [courseIdsString]);

  const { data: rawSubjects } = useCachedData<SubjectRow[]>(SUBJECTS_CACHE_KEY, fetchSubjects, [courseIdsString]);
  const safeSubjects = useMemo<SubjectRow[]>(() => normalizeCachedSubjects(rawSubjects), [rawSubjects]);

  /* ─── 5. Derived state ─── */
  const loading = cLoading;

  const subjectMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    safeSubjects.forEach((s) => { (m[s.course_id] ??= []).push(s.name); });
    return m;
  }, [safeSubjects]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') searchRef.current?.blur();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    let list = safeCourses;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((c) => {
        const inFields = c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.instructor?.toLowerCase().includes(q);
        const inSubjects = (subjectMap[c.id] ?? []).some((s) => s.toLowerCase().includes(q));
        return inFields || inSubjects;
      });
    }
    return [...list].sort((a, b) =>
      sort === 'newest'
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [safeCourses, subjectMap, search, sort]);

  const clearSearch = () => {
    setSearch('');
    searchRef.current?.focus();
  };

  return (
    <div className="flex-1 min-h-screen bg-background">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        .discount-glow { animation: pulseGlow 2s ease-in-out infinite; }
        @keyframes tickPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .tick-colon { animation: tickPulse 1s ease-in-out infinite; }
        
        /* Premium Shimmer for Quick Load Perception */
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .shimmer-overlay {
          background: linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--muted)/0.4) 50%, hsl(var(--muted)) 100%);
          background-size: 800px 100%;
          animation: shimmer 1.5s infinite linear;
        }
      `}</style>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/30 bg-gradient-to-br from-primary/5 via-background to-primary/[0.02]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(var(--primary),0.08),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8 sm:pt-16 sm:pb-12">
          <div style={{ animation: 'fadeUp .5s ease-out both' }}>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Explore Courses
            </h1>
            <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
              Master every subject with structured courses designed for JEE, NEET &amp; board exams.
            </p>
          </div>

          <div className="mt-8 flex max-w-2xl gap-3" style={{ animation: 'fadeUp .5s ease-out .1s both' }}>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search courses, topics, instructors… (press "/")'
                className="h-12 border-border/50 bg-background/80 text-sm backdrop-blur-lg focus-visible:ring-primary/30 pl-11 pr-9 rounded-xl shadow-sm"
              />
              {search && (
                <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
              className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-border/50 bg-background/80 text-sm font-medium backdrop-blur-lg hover:border-primary/30 hover:bg-background px-5 shadow-sm transition-all"
            >
              {sort === 'newest' ? (
                <ArrowDownWideNarrow className="w-4 h-4 text-primary" />
              ) : (
                <ArrowUpWideNarrow className="w-4 h-4 text-primary" />
              )}
              <span className="hidden sm:inline">{sort === 'newest' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground" style={{ animation: 'fadeUp .5s ease-out .2s both' }}>
            <span className="font-semibold text-foreground/80">{safeCourses.length} course{safeCourses.length !== 1 && 's'}</span>
            <span className="h-3 w-px bg-border/50" />
            <span>Sorted: {sort === 'newest' ? 'Newest first' : 'Oldest first'}</span>
            {search && (
              <>
                <span className="h-3 w-px bg-border/50" />
                <span>
                  {filtered.length} result{filtered.length !== 1 && 's'} for &ldquo;<strong className="text-foreground">{search}</strong>&rdquo;
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 pt-8 sm:pt-10">
        {loading ? (
          <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ animation: `fadeUp .4s ease-out ${i * 0.05}s both` }}>
                <CourseSkeleton />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center" style={{ animation: 'fadeUp .4s ease-out' }}>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
              <BookOpen className="h-9 w-9 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold">No courses found</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {search
                ? `Nothing matches "${search}". Try different keywords or clear the search.`
                : 'No courses published yet. Check back soon!'}
            </p>
            {search && (
              <button onClick={clearSearch} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2">
                Clear search <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((c, i) => (
              <RevealCard key={c.id} index={i}>
                <CourseCard c={c} />
              </RevealCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Courses;