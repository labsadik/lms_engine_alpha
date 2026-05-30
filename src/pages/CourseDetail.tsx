import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Play, BookOpen, Tag, CheckCircle2, ArrowRight, Lock, Clock, Flame, Share2, Copy, Check, AlertTriangle, ChevronDown, Layers, HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatPriceINR } from '@/lib/format';
import { useSEO } from '@/lib/seo';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── DETERMINISTIC DISCOUNT & TIMER HELPERS ───

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
  const index = seed % COURSE_DISCOUNTS.length;
  return COURSE_DISCOUNTS[index];
};

const getOriginalPrice = (actualPrice: number, discountPercent: number): number => {
  if (actualPrice <= 0) return 0;
  const raw = actualPrice / (1 - discountPercent / 100);
  return Math.ceil(raw / 100) * 100;
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
  if (deadline.getTime() <= now.getTime()) deadline.setFullYear(deadline.getFullYear() + 1);
  return deadline;
};

// ─── RICH TEXT ───

const RichText = ({ text }: { text: string }) => {
  const formattedHtml = text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em class="text-foreground/80">$1</em>')
    .replace(/^[\-\*] (.*$)/gm, '<li class="ml-2 pl-3 relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary/40 text-foreground/80">$1</li>')
    .replace(/\n/g, '<br />');

  return (
    <div
      className="text-foreground/90 leading-relaxed text-sm sm:text-base"
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
};

// ─── FAQ DATA ───
const FAQ_DATA = [
  {
    q: "How long is this course valid?",
    a: "The course is valid until the specific date mentioned in the course description above. Please check the validity period details provided in the description before enrolling to ensure it fits your schedule."
  },
  {
    q: "Can I ask doubts anytime?",
    a: "Absolutely! We provide anytime WhatsApp support for all enrolled students. You can ask your doubts directly on WhatsApp, and our team will assist you as quickly as possible."
  },
  {
    q: "Are the classes live or recorded?",
    a: "Depending on the course curriculum, classes may be live, recorded, or a combination of both. Please refer to the course description above to see the exact format and schedule for this specific course."
  },
  {
    q: "How do I stay updated about the course?",
    a: "You can read about course updates and details directly in the description section above. Additionally, we highly recommend following us on our social media platforms for real-time announcements and news regarding this course."
  },
  {
    q: "Is student support provided?",
    a: "Yes! We offer dedicated student support, including 1-to-1 mentorship, to ensure you get personalized guidance and have all your academic queries resolved throughout your learning journey."
  }
];

// ─── COMPONENT ───

const CourseDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState<any>(null);
  const [tree, setTree] = useState<any[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const [timeLeft, setTimeLeft] = useState({ d: 0, m: 0, s: 0 });
  const [copied, setCopied] = useState(false);

  const discountDisplay = useMemo(() => {
    if (!course || course.price_inr <= 0) return { percent: 0, original: 0, savings: 0 };
    const percent = getYearlyCourseDiscount(course.id);
    const original = getOriginalPrice(course.price_inr, percent);
    return { percent, original, savings: original - course.price_inr };
  }, [course?.id, course?.price_inr]);

  useEffect(() => {
    if (!course?.id || course.price_inr <= 0) return;
    const deadline = getCourseDeadline(course.id);
    const calculateTimeLeft = () => {
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();
      if (diff <= 0) return { d: 0, m: 0, s: 0 };
      return {
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        m: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60)),
        s: Math.floor((diff % (1000 * 60)) / 1000),
      };
    };
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [course?.id, course?.price_inr]);

  useSEO({
    title: course ? `${course.title} — LearnHub` : 'Course — LearnHub',
    description: course?.meta_description || course?.description || 'Online course on LearnHub.',
    image: course?.thumbnail_url,
    jsonLd: course ? {
      '@context': 'https://schema.org', '@type': 'Course', name: course.title,
      description: course.description, provider: { '@type': 'Organization', name: 'LearnHub' },
      offers: { '@type': 'Offer', price: course.price_inr, priceCurrency: 'INR' },
    } : undefined,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('canceled') === '1') {
      toast.info('Payment canceled.');
      window.history.replaceState({}, '', `/courses/${slug}`);
    }
    const load = async () => {
      setLoading(true);
      const { data: c } = await supabase.from('courses').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
      if (!c) { setLoading(false); return; }
      setCourse(c);
      const { data: subjects } = await supabase.from('subjects').select('id, name, position, chapters(id, name, position, parts(id, name, video_id, notes_url, duration, position, is_preview))').eq('course_id', c.id).order('position');
      const sorted = (subjects || []).map((s: any) => ({ ...s, chapters: (s.chapters || []).sort((a: any, b: any) => a.position - b.position).map((ch: any) => ({ ...ch, parts: (ch.parts || []).sort((a: any, b: any) => a.position - b.position) })) }));
      setTree(sorted);

      if (user) {
        const [enRes, profRes] = await Promise.all([
          supabase.from('enrollments').select('id').eq('user_id', user.id).eq('course_id', c.id).maybeSingle(),
          supabase.from('profiles').select('*').eq('user_id', user.id).single()
        ]);

        if (enRes.data) setEnrolled(true);
        if (profRes.data) setProfile(profRes.data);
      }
      setLoading(false);
    };
    load();
  }, [slug, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') !== '1' || !user || !course?.id) return;
    let cancelled = false;
    const verifyEnrollment = async () => {
      setVerifyingPayment(true);
      toast.success('Payment successful! Verifying your enrollment…');
      const checkEnroll = async () => {
        const { data: en } = await supabase.from('enrollments').select('id').eq('user_id', user.id).eq('course_id', course.id).maybeSingle();
        return !!en;
      };
      let isEnrolled = false;
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        isEnrolled = await checkEnroll();
        if (isEnrolled) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!isEnrolled) {
        try {
          const sessionId = params.get('session_id');
          const { data, error } = await supabase.functions.invoke('verify-enrollment', { body: { course_id: course.id, session_id: sessionId } });
          if (!error && (data as any)?.enrolled) isEnrolled = true;
          else {
            let errorMessage = 'Unknown verification error';
            if (error) {
              try {
                if (error.context && typeof error.context.json === 'function') {
                  const errBody = await error.context.json();
                  errorMessage = errBody?.error || errBody?.details || errorMessage;
                }
              } catch { }
            }
            console.error('Manual verify failed:', errorMessage);
            toast.error(`Verification failed: ${errorMessage}`);
          }
        } catch (err: any) { console.error('Manual verify exception:', err); }
      }
      if (!cancelled) {
        setEnrolled(isEnrolled);
        setVerifyingPayment(false);
        if (isEnrolled) {
          toast.success('You are now enrolled!');
          window.history.replaceState({}, '', `/courses/${slug}`);
        } else {
          toast.error('Enrollment is taking longer than expected. Please contact support.');
        }
      }
    };
    verifyEnrollment();
    return () => { cancelled = true; };
  }, [slug, user, course?.id]);

  const checkProfileCompletion = (p: any) => {
    if (!p) return { isComplete: false, missing: ["Profile data"] };
    const missing: string[] = [];
    if (!p.display_name) missing.push("Name");
    if (!p.phone) missing.push("Phone");
    if (!p.avatar_url) missing.push("Photo");
    if (!p.gender) missing.push("Gender");
    if (!p.date_of_birth) missing.push("DOB");
    if (!p.language) missing.push("Language");
    if (!p.address) missing.push("Address");
    if (!p.city) missing.push("City");
    if (!p.state) missing.push("State");
    if (!p.country) missing.push("Country");
    if (!p.pincode) missing.push("Pincode");
    return { isComplete: missing.length === 0, missing };
  };

  const handleEnroll = async () => {
    if (!user) { nav('/auth'); return; }
    if (!course?.id) { toast.error('Course information is missing.'); return; }

    const { isComplete, missing } = checkProfileCompletion(profile);
    if (!isComplete) {
      toast.error('Profile Incomplete', {
        description: `Please complete your profile (100%) before buying. Missing: ${missing.slice(0, 3).join(', ')}...`,
        icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
        action: { label: "Complete Profile", onClick: () => nav('/profile') },
      });
      return;
    }

    setEnrolling(true);
    nav('/checkout', { state: { courseId: course.id } });
  };

  const handleLockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      nav('/auth');
      toast.info('Please login to access locked lectures');
      return;
    }
    if (!enrolled) {
      toast.info('Please enroll to access this lecture');
      return;
    }
  };

  const courseUrl = `${window.location.origin}/courses/${course?.slug}`;
  const shareText = course ? `Check out this course: ${course.title} 🔥` : '';

  const handleNativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: course.title, text: shareText, url: courseUrl }); } catch (error) { }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(courseUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex-1 min-h-screen max-w-7xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-10 w-3/4 rounded-xl shimmer-overlay bg-muted" />
          <div className="h-6 w-1/2 rounded-lg shimmer-overlay bg-muted" />
          <div className="h-32 w-full rounded-xl shimmer-overlay bg-muted" />
          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="h-24 w-full rounded-xl shimmer-overlay bg-muted" />
            <div className="h-24 w-full rounded-xl shimmer-overlay bg-muted" />
          </div>
        </div>
        <div className="hidden lg:block">
          <div className="sticky top-24 h-[500px] rounded-2xl shimmer-overlay bg-muted" />
        </div>
      </div>
    </div>
  );

  if (!course) return (<div className="flex-1 flex items-center justify-center text-muted-foreground py-20">Course not found</div>);

  return (
    <div className="flex-1 min-h-screen bg-background">
      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); } 50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); } }
        .anim-up  { animation: fadeSlideUp 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        .anim-d1  { animation-delay: 0.1s; }
        .anim-d2  { animation-delay: 0.2s; }
        .anim-d3  { animation-delay: 0.3s; }
        .discount-glow { animation: pulseGlow 2s ease-in-out infinite; }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .shimmer-overlay { background: linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--muted)/0.4) 50%, hsl(var(--muted)) 100%); background-size: 800px 100%; animation: shimmer 1.5s infinite linear; }
      `}</style>

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">

          {/* ═══════ LEFT COLUMN ═══════ */}
          <div className="lg:col-span-2 space-y-8 order-2 lg:order-1">
            
            {/* Header Info */}
            <div className="anim-up">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">{course.title}</h1>
              {course.instructor && (
                <p className="mt-3 text-muted-foreground flex items-center gap-2.5 text-sm sm:text-base">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center ring-2 ring-primary/20">
                    {course.instructor.charAt(0)}
                  </span>
                  <span>Taught by <span className="font-semibold text-foreground">{course.instructor}</span></span>
                </p>
              )}
              {course.price_inr > 0 && (
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span className="discount-glow inline-flex items-center gap-1.5 bg-red-500 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-sm">
                    <Flame className="w-3 h-3" /> {discountDisplay.percent}% OFF
                  </span>
                  <span className="text-sm text-muted-foreground">
                    <span className="line-through">{formatPriceINR(discountDisplay.original)}</span>{' '}
                    <span className="font-bold text-foreground">{formatPriceINR(course.price_inr)}</span>
                  </span>
                </div>
              )}
              
              {course.description && (
                <div className="mt-6 bg-muted/20 rounded-2xl p-5 sm:p-6 border border-border/30">
                  <div className={`${!isDescExpanded ? 'line-clamp-3' : ''} text-foreground/80`}>
                    <RichText text={course.description} />
                  </div>
                  {course.description.length > 150 && (
                    <button onClick={() => setIsDescExpanded(!isDescExpanded)} className="text-sm text-primary font-semibold mt-3 hover:underline inline-flex items-center gap-1">
                      {isDescExpanded ? 'Show less' : 'Read more'} <ChevronDown className={cn("w-4 h-4 transition-transform", isDescExpanded && "rotate-180")} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Course Curriculum - ONLY SUBJECTS */}
            <div className="anim-up anim-d2">
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-primary" /> Course Curriculum
              </h2>
              {tree.length === 0 ? (
                <p className="text-muted-foreground text-sm bg-muted/20 rounded-xl p-6 border border-dashed border-border/50 text-center">No content added yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tree.map((subject: any, sIdx: number) => {
                    const chapterCount = subject.chapters?.length || 0;
                    const lectureCount = subject.chapters?.reduce((acc: number, ch: any) => acc + (ch.parts?.length || 0), 0) || 0;

                    return (
                      <div key={subject.id} className="group flex items-start gap-4 p-5 rounded-2xl border border-border/30 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300 hover:-translate-y-0.5">
                        <div className="flex w-10 h-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-base font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {sIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{subject.name}</h3>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" /> {chapterCount} Chapter{chapterCount !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Play className="w-3 h-3" /> {lectureCount} Lecture{lectureCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ═══════ FREQUENTLY ASKED QUESTIONS ═══════ */}
            <div className="anim-up anim-d3">
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2.5">
                <HelpCircle className="w-5 h-5 text-primary" /> Frequently Asked Questions
              </h2>
              
              <Accordion type="single" collapsible className="space-y-3">
                {FAQ_DATA.map((faq, idx) => (
                  <AccordionItem key={idx} value={`faq-${idx}`} className="border border-border/30 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow px-5">
                    <AccordionTrigger className="text-left text-sm sm:text-base font-semibold py-4 hover:no-underline hover:bg-muted/20 transition-colors">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-5">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

          </div>

          {/* ═══════ RIGHT SIDEBAR ═══════ */}
          <aside className="lg:sticky lg:top-24 self-start anim-up anim-d1 order-1 lg:order-2">
            <Card className="overflow-hidden bg-card border-border/40 shadow-2xl shadow-black/5 rounded-2xl">
              {course.thumbnail_url && (
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                  {course.price_inr > 0 && (
                    <div className="absolute top-3 left-3 discount-glow bg-red-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" /> {discountDisplay.percent}% OFF
                    </div>
                  )}
                </div>
              )}

              <div className="p-5 sm:p-6 space-y-5">
                {verifyingPayment ? (
                  <div className="space-y-3 py-6 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <div className="font-semibold text-lg">Verifying Payment…</div>
                    <p className="text-xs text-muted-foreground">Confirming your enrollment. This may take a few seconds.</p>
                  </div>
                ) : enrolled ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5 text-green-500 font-bold text-lg">
                      <CheckCircle2 className="w-5 h-5" /> Enrolled
                    </div>
                    <Button asChild className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20" size="lg">
                      <Link to={`/learn/${course.slug}`} className="gap-2">Continue Learning <ArrowRight className="w-4 h-4" /></Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    {course.price_inr > 0 && (
                      <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-red-500 to-orange-500 rounded-xl p-4 text-white shadow-inner">
                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
                        <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />
                        <div className="relative z-10 flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-extrabold leading-none">{discountDisplay.percent}%</div>
                            <div className="text-[11px] uppercase tracking-widest opacity-80 mt-0.5 font-medium">Special Offer</div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 justify-end text-white/80 mb-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-[10px] uppercase tracking-wider font-medium">Ends in</span>
                            </div>
                            <div className="flex items-center gap-1 font-mono text-lg font-extrabold tabular-nums tracking-tight">
                              <span className="bg-black/20 rounded-md px-1.5 py-0.5 flex items-center justify-center min-w-[28px]">
                                {String(timeLeft.d).padStart(2, '0')}<span className="text-[9px] ml-0.5 opacity-80">D</span>
                              </span>
                              <span className="text-white/80 animate-pulse">:</span>
                              <span className="bg-black/20 rounded-md px-1.5 py-0.5 flex items-center justify-center min-w-[28px]">
                                {String(timeLeft.m).padStart(2, '0')}<span className="text-[9px] ml-0.5 opacity-80">M</span>
                              </span>
                              <span className="text-white/80 animate-pulse">:</span>
                              <span className="bg-black/20 rounded-md px-1.5 py-0.5 flex items-center justify-center min-w-[28px]">
                                {String(timeLeft.s).padStart(2, '0')}<span className="text-[9px] ml-0.5 opacity-80">S</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {course.price_inr > 0 ? (
                        <>
                          <div className="flex items-baseline gap-3 flex-wrap">
                            <span className="text-4xl font-extrabold text-foreground tracking-tight">{formatPriceINR(course.price_inr)}</span>
                            <span className="text-lg text-muted-foreground line-through decoration-red-400/60 decoration-2">{formatPriceINR(discountDisplay.original)}</span>
                          </div>
                          <p className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
                            <Tag className="w-4 h-4" /> You save {formatPriceINR(discountDisplay.savings)} on this course
                          </p>
                        </>
                      ) : (
                        <span className="text-4xl font-extrabold text-green-600">FREE</span>
                      )}
                    </div>

                    <Button className="w-full h-14 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl" size="lg" onClick={handleEnroll} disabled={enrolling}>
                      {enrolling ? (<Loader2 className="w-5 h-5 animate-spin" />) : !user ? ('Sign in to Enroll') : course.price_inr === 0 ? ('Enroll for Free') : ('Buy Now')}
                    </Button>

                    {!user && (<p className="text-[11px] text-muted-foreground text-center leading-relaxed">Sign in to enroll and track your progress.</p>)}
                  </>
                )}

                {/* ─── SHARE SECTION ─── */}
                <div className="pt-4 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Share this course</span>

                    {typeof navigator.share === 'function' ? (
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs rounded-lg" onClick={handleNativeShare}>
                        <Share2 className="w-3.5 h-3.5" /> Share
                      </Button>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs rounded-lg">
                            <Share2 className="w-3.5 h-3.5" /> Share
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2 shadow-xl rounded-xl" align="end">
                          <div className="grid grid-cols-4 gap-1">
                            <a href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + courseUrl)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors">
                              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                              <span className="text-[9px] mt-1 font-medium">WhatsApp</span>
                            </a>
                            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(courseUrl)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors">
                              <svg className="w-5 h-5 text-foreground" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                              <span className="text-[9px] mt-1 font-medium">X</span>
                            </a>
                            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(courseUrl)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors">
                              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                              <span className="text-[9px] mt-1 font-medium">LinkedIn</span>
                            </a>
                            <button onClick={copyToClipboard} className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors">
                              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                              <span className="text-[9px] mt-1 font-medium">{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>

              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;