import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSEO } from '@/lib/seo';
import {
  Loader2, Play, Video, Radio, StickyNote, Clock,
  CalendarDays, BookOpen, ChevronDown, ChevronLeft,
  ChevronRight, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import AnnouncementBell from '@/components/AnnouncementBell';
import GamifyChip from '@/components/GamifyChip';
import { useCachedData } from '@/hooks/useCachedData';

// ─── INTERFACES ───
interface CourseBasic {
  id: string;
  title: string;
  slug: string;
}

interface PartItem {
  id: string;
  name: string;
  kind: 'recorded' | 'live';
  created_at: string;
  notes_url: string | null;
  course_slug: string;
  course_id: string;
  duration: string | null;
  live_chat_enabled: boolean;
}

function normalizeArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const inner = (raw as Record<string, unknown>).data;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

/* ════════════════════════════════════════════════════════
   MAIN STUDY PAGE
   ════════════════════════════════════════════════════════ */
const Study = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  useSEO({
    title: 'My Learning — LearnHub',
    description: 'Manage your schedule and courses.',
  });

  // ─── 1. CACHED: Enrolled Courses ───
  const { data: rawEnrolled, loading: isLoadingEnrolled } = useCachedData<CourseBasic[]>(
    user ? `user:${user.id}:enrollments` : '__no_user__',
    async () => {
      if (!user) return [];
      const { data: ens } = await supabase
        .from('enrollments')
        .select('id, courses(id, slug, title)')
        .eq('user_id', user.id);
      return (ens || []).map((e: any) => e.courses).filter(Boolean);
    },
    [user?.id],
    []
  );

  const enrolled = useMemo(() => normalizeArray<CourseBasic>(rawEnrolled), [rawEnrolled]);

  useEffect(() => {
    if (!selectedCourseId && enrolled.length > 0) {
      setSelectedCourseId(enrolled[0].id);
    }
  }, [enrolled, selectedCourseId]);

  // ─── 2. CACHED: Parts ───
  const { data: rawParts, loading: isLoadingParts } = useCachedData<PartItem[]>(
    selectedCourseId ? `course:${selectedCourseId}:parts` : '__no_course__',
    async () => {
      if (!selectedCourseId) return [];
      const currentCourse = enrolled.find((c) => c.id === selectedCourseId);
      const courseSlug = currentCourse?.slug || '';

      const { data: parts, error } = await supabase
        .from('parts')
        .select(
          `id, name, kind, created_at, notes_url, duration, live_chat_enabled, chapter:chapters!inner ( subject:subjects!inner ( course_id ) )`
        )
        .eq('chapter.subject.course_id', selectedCourseId);

      if (error) throw error;

      return (parts || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        created_at: p.created_at,
        notes_url: p.notes_url,
        duration: p.duration,
        live_chat_enabled: p.live_chat_enabled || false,
        course_slug: courseSlug,
        course_id: selectedCourseId,
      }));
    },
    [selectedCourseId],
    []
  );

  const allParts = useMemo(() => normalizeArray<PartItem>(rawParts), [rawParts]);
  const loading = isLoadingEnrolled;

  // ─── MEMOIZED FILTERS ───
  const selectedDayEvents = useMemo(() => {
    const iso = selectedDate.toDateString();
    return allParts.filter((e) => new Date(e.created_at).toDateString() === iso);
  }, [selectedDate, allParts]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, PartItem[]>();
    allParts.forEach((p) => {
      const dateStr = new Date(p.created_at).toDateString();
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(p);
    });
    return map;
  }, [allParts]);

  const liveCount = useMemo(
    () => selectedDayEvents.filter((e) => e.kind === 'live').length,
    [selectedDayEvents]
  );
  const recordedCount = useMemo(
    () => selectedDayEvents.filter((e) => e.kind === 'recorded').length,
    [selectedDayEvents]
  );

  const handleEventClick = (event: PartItem) => {
    if (!event.course_slug) return;
    navigate(`/learn/${event.course_slug}?lectureId=${event.id}`);
  };

  const handleDateChange = (value: Date) => {
    setSelectedDate(value);
    setIsMobileSheetOpen(false);
  };

  const formattedSelectedDate = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // ─── RENDER ───
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading your courses…</p>
        </div>
      </div>
    );

  return (
    <>
      {/* ─── MOBILE CALENDAR SHEET ─── */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-all duration-300',
          isMobileSheetOpen ? 'visible' : 'invisible pointer-events-none'
        )}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
            isMobileSheetOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setIsMobileSheetOpen(false)}
        />
        <div
          className={cn(
            'absolute left-0 right-0 bg-card rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out overflow-hidden',
            isMobileSheetOpen ? 'translate-y-0' : 'translate-y-full'
          )}
          style={{
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            maxHeight: 'calc(100vh - 120px - env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="px-5 pt-1 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground text-base">Pick a Date</h3>
              <p className="text-xs text-muted-foreground mt-0.5">See your day/weekly scheduled classes</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-muted"
              onClick={() => setIsMobileSheetOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="px-2 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <CalendarSheet
              selectedDate={selectedDate}
              eventsByDate={eventsByDate}
              onChange={handleDateChange}
            />
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 w-full max-w-[1400px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
        {/* ─── HEADER ─── */}
        <header className="space-y-4 sm:space-y-5">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground truncate">
                My Learning
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Track your schedule and progress.
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <GamifyChip />
              <AnnouncementBell />
            </div>
          </div>

          {enrolled.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 sm:flex-none sm:w-[300px] lg:w-[340px]">
                <Select value={selectedCourseId || ''} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="w-full bg-card border-border/60 shadow-sm rounded-xl h-10 sm:h-11 text-sm focus:ring-primary/20">
                    <BookOpen className="w-4 h-4 mr-2 text-primary/70 shrink-0" />
                    <SelectValue placeholder="Select Course" />
                  </SelectTrigger>
                  <SelectContent
                    className="rounded-xl border-border/50 bg-card shadow-xl p-1.5"
                    position="popper"
                    sideOffset={6}
                  >
                    {enrolled.map((c) => (
                      <SelectItem
                        key={c.id}
                        value={c.id}
                        className="rounded-lg focus:bg-primary/10 focus:text-primary cursor-pointer py-2.5 px-3 transition-colors text-sm"
                      >
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </header>

        {/* ─── EMPTY STATE ─── */}
        {enrolled.length === 0 && !loading && (
          <Card className="p-8 sm:p-12 text-center bg-muted/5 border-dashed border-2 border-border/40 flex flex-col items-center justify-center min-h-[320px] sm:min-h-[400px] rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-5">
              <BookOpen className="w-8 h-8 text-primary/30" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-1.5">No Courses Yet</h3>
            <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
              It looks like you haven't enrolled in any courses. Start learning by exploring our catalog.
            </p>
          </Card>
        )}

        {/* ─── MAIN GRID ─── */}
        {selectedCourseId && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            {/* ─── LEFT: CALENDAR (Desktop) ─── */}
            <div className="hidden lg:block lg:col-span-7 xl:col-span-7 space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground text-sm">Schedule</h2>
                    <p className="text-[11px] text-muted-foreground">See your day/weekly scheduled classes</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 rounded-lg border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Today
                </Button>
              </div>

              <Card className="border-border/30 bg-card shadow-sm rounded-2xl overflow-hidden p-0">
                <CalendarSheet
                  selectedDate={selectedDate}
                  eventsByDate={eventsByDate}
                  onChange={handleDateChange}
                />
              </Card>
            </div>

            {/* ─── RIGHT: EVENTS ─── */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-4">
              {/* Mobile: Date picker trigger */}
              <div className="flex lg:hidden items-center gap-3">
                <button
                  onClick={() => setIsMobileSheetOpen(true)}
                  className="flex-1 flex items-center gap-3 p-3.5 bg-card rounded-xl shadow-sm border border-border/30 active:scale-[0.98] transition-transform"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {formattedSelectedDate}
                    </p>
                    <p className="text-[11px] text-muted-foreground">See your day/weekly scheduled classes</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-[52px] px-3 rounded-xl border-border/30 text-xs shrink-0"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Today
                </Button>
              </div>

              {/* Desktop: Header */}
              <div className="hidden lg:flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">
                      {formattedSelectedDate}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">See your day/weekly scheduled classes</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 rounded-lg border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Today
                </Button>
              </div>

              {/* Stats chips */}
              {selectedDayEvents.length > 0 && (
                <div className="flex items-center gap-2 px-1">
                  <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold px-2.5 py-1 rounded-lg">
                    <Video className="w-3 h-3" />
                    {recordedCount} Recorded
                  </div>
                  {liveCount > 0 && (
                    <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-semibold px-2.5 py-1 rounded-lg">
                      <Radio className="w-3 h-3" />
                      {liveCount} Live
                    </div>
                  )}
                </div>
              )}

              {/* Events list */}
              <div className="space-y-2.5 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto lg:pr-1 custom-scrollbar pb-20 lg:pb-4">
                {isLoadingParts ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-[72px] bg-muted/30 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    {selectedDayEvents.length === 0 ? (
                      <Card className="p-8 text-center text-muted-foreground border-dashed border-2 border-border/30 rounded-2xl bg-muted/5">
                        <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                          <Video className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-medium text-foreground/70">No lectures</p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          scheduled for this day
                        </p>
                      </Card>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedDayEvents.map((ev, idx) => (
                          <EventCard
                            key={ev.id}
                            event={ev}
                            onClick={() => handleEventClick(ev)}
                            index={idx}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

/* ════════════════════════════════════════════════════════
   CALENDAR SHEET COMPONENT
   ════════════════════════════════════════════════════════ */
const CalendarSheet = ({
  selectedDate,
  eventsByDate,
  onChange,
}: {
  selectedDate: Date;
  eventsByDate: Map<string, PartItem[]>;
  onChange: (date: Date) => void;
}) => (
  <>
    <style>{`
      .react-calendar {
        width: 100%;
        border: none;
        font-family: inherit;
        background: transparent;
        line-height: 1.5;
        padding: 16px;
      }
      .react-calendar__navigation {
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .react-calendar__navigation button {
        font-size: 15px;
        font-weight: 600;
        color: hsl(var(--foreground));
        min-width: 36px;
        border-radius: 10px;
        transition: background 0.15s;
      }
      .react-calendar__navigation button:disabled {
        background-color: transparent;
        color: hsl(var(--muted-foreground) / 0.4);
      }
      .react-calendar__navigation button:enabled:hover,
      .react-calendar__navigation button:enabled:focus {
        background-color: hsl(var(--accent));
      }
      .react-calendar__navigation__label {
        flex-grow: 1 !important;
        font-weight: 700;
        font-size: 15px;
      }
      .react-calendar__month-view__weekdays {
        color: hsl(var(--muted-foreground));
        text-align: center;
        text-transform: uppercase;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        margin-bottom: 4px;
      }
      .react-calendar__month-view__weekdays abbr { text-decoration: none; }
      .react-calendar__month-view__weekdays__weekday { padding: 6px 2px; }
      .react-calendar__month-view__days { row-gap: 2px; }
      .react-calendar__tile {
        padding: 0;
        background: transparent;
        border-radius: 10px;
        position: relative;
        height: 52px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: hsl(var(--foreground));
        font-size: 13px;
        font-weight: 500;
        border: 2px solid transparent;
        transition: all 0.15s ease;
      }
      .react-calendar__month-view__days__day--neighboringMonth {
        color: hsl(var(--muted-foreground) / 0.3);
      }
      .react-calendar__tile:enabled:hover { background-color: hsl(var(--accent)); }
      .react-calendar__tile--now {
        background: transparent;
        border: 2px solid hsl(var(--primary) / 0.4);
        font-weight: 700;
        color: hsl(var(--primary));
      }
      .react-calendar__tile--now:enabled:hover { background: hsl(var(--primary) / 0.06); }
      .react-calendar__tile--active {
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        font-weight: 700;
        border-color: transparent;
        border-radius: 10px;
      }
      .react-calendar__tile--active:enabled:hover { background: hsl(var(--primary)); }
      .event-dot-row {
        position: absolute;
        bottom: 5px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        gap: 3px;
        pointer-events: none;
      }
      .event-dot-row .dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
      }
      .event-dot-row .dot.live { background: hsl(25 95% 53%); }
      .event-dot-row .dot.recorded { background: hsl(217 91% 60%); }
      .react-calendar__tile--active .event-dot-row .dot.live,
      .react-calendar__tile--active .event-dot-row .dot.recorded {
        background: hsl(var(--primary-foreground) / 0.7);
      }
      @media (max-width: 640px) {
        .react-calendar { padding: 10px; }
        .react-calendar__tile { height: 44px; font-size: 12px; border-radius: 8px; }
        .react-calendar__navigation button { font-size: 14px; min-width: 32px; }
        .react-calendar__navigation__label { font-size: 14px; }
        .event-dot-row .dot { width: 4px; height: 4px; }
      }
      @media (min-width: 1024px) {
        .react-calendar__tile { height: 58px; font-size: 14px; }
      }
    `}</style>

    <Calendar
      onChange={(value) => onChange(value as Date)}
      value={selectedDate}
      nextLabel={<ChevronRight className="w-4 h-4" />}
      prevLabel={<ChevronLeft className="w-4 h-4" />}
      next2Label={null}
      prev2Label={null}
      tileContent={({ date, view }) => {
        if (view === 'month') {
          const dateStr = date.toDateString();
          const dayEvents = eventsByDate.get(dateStr) || [];
          if (dayEvents.length > 0) {
            const live = dayEvents.filter((e) => e.kind === 'live').length;
            const recorded = dayEvents.filter((e) => e.kind === 'recorded').length;
            const dots: JSX.Element[] = [];
            for (let i = 0; i < Math.min(live, 2); i++) dots.push(<span key={`l${i}`} className="dot live" />);
            for (let i = 0; i < Math.min(recorded, 3 - dots.length); i++) dots.push(<span key={`r${i}`} className="dot recorded" />);
            return <div className="event-dot-row">{dots}</div>;
          }
        }
        return null;
      }}
    />
  </>
);

/* ════════════════════════════════════════════════════════
   EVENT CARD COMPONENT
   ════════════════════════════════════════════════════════ */
const EventCard = ({
  event,
  onClick,
  index,
}: {
  event: PartItem;
  onClick: () => void;
  index: number;
}) => {
  const isLive = event.kind === 'live';

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer border-border/30 bg-card hover:bg-accent/40 transition-all duration-200 rounded-xl shadow-sm active:scale-[0.98] sm:active:scale-100"
      onClick={onClick}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Color accent bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-colors',
          isLive ? 'bg-orange-500' : 'bg-blue-500'
        )}
      />

      <div className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 pl-5 sm:pl-5">
        {/* Icon */}
        <div
          className={cn(
            'w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors',
            isLive
              ? 'bg-orange-50 dark:bg-orange-950/30 group-hover:bg-orange-100 dark:group-hover:bg-orange-950/50'
              : 'bg-blue-50 dark:bg-blue-950/30 group-hover:bg-blue-100 dark:group-hover:bg-blue-950/50'
          )}
        >
          {isLive ? (
            <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
          ) : (
            <Video className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
          <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {event.name}
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-[11px] text-muted-foreground">
            {/* ★ LIVE TAG ★ */}
            {isLive ? (
              <span className="inline-flex items-center gap-1 font-bold text-orange-500 uppercase tracking-wider text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Live
              </span>
            ) : (
              /* ★ RECORDED TAG ★ */
              <span className="inline-flex items-center gap-1 font-bold text-blue-500 uppercase tracking-wider text-[10px]">
                <Video className="w-2.5 h-2.5" />
                Recorded
              </span>
            )}
            {event.duration && (
              <>
                <span className="opacity-40">•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {event.duration}
                </span>
              </>
            )}
            <span className="opacity-40">•</span>
            <span>
              {new Date(event.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {event.notes_url && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                window.open(event.notes_url!, '_blank');
              }}
            >
              <StickyNote className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground hover:text-primary" />
            </Button>
          )}
          <div
            className={cn(
              'w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors',
              isLive
                ? 'bg-orange-500 text-white group-hover:bg-orange-600'
                : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
            )}
          >
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default Study;