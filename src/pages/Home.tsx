import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatPriceINR } from '@/lib/format';
import {
  GraduationCap, Trophy, Zap, Users, BookOpen, Award,
  ChevronLeft, ChevronRight, ChevronDown, Star, Play,
  ArrowRight, Flame, Target, ShieldCheck, TrendingUp,
  CheckCircle2, Sparkles, XCircle, X, Smartphone,
  Menu, BookMarked, FileText, LayoutGrid, Info, Check
} from 'lucide-react';
import { useSEO } from '@/lib/seo';
import Lenis from 'lenis';

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
const cn = (...cls: (string | false | undefined | null)[]) =>
  cls.filter(Boolean).join(' ');

type Platform = 'android' | 'ios' | 'other';

function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || (navigator as any).platform || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || ((navigator as any).platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'other';
}

function isMobilePlatform(): boolean {
  const p = getPlatform();
  return p === 'android' || p === 'ios';
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */
type NavSubItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavItem = {
  id: string;
  label: string;
  submenu?: NavSubItem[];
  hash?: string;
  to?: string;
};

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */
const NAV_ITEMS: NavItem[] = [
  {
    id: 'courses',
    label: 'Courses',
    submenu: [
      { label: 'JEE Foundation (Class 9)', to: '/courses/jee-foundation-9', icon: BookOpen },
      { label: 'JEE Foundation (Class 10)', to: '/courses/jee-foundation-10', icon: BookOpen },
      { label: 'JEE 2026 (Class 11)', to: '/courses/jee-2026', icon: Zap },
      { label: 'JEE 2025 (Class 12)', to: '/courses/jee-2025', icon: Zap },
      { label: 'NEET 2025', to: '/courses/neet-2025', icon: LayoutGrid },
      { label: 'All Courses', to: '/courses', icon: BookMarked },
    ],
  },
  { id: 'features', label: 'Features', hash: '#features' },
  {
    id: 'resources',
    label: 'Resources',
    submenu: [
      { label: 'Blog', to: '/blog', icon: FileText },
      { label: 'Free Study Material', to: '/resources/free', icon: BookOpen },
      { label: 'Previous Year Papers', to: '/resources/pyq', icon: FileText },
      { label: 'Formula Sheets', to: '/resources/formulas', icon: LayoutGrid },
    ],
  },
  { id: 'educators', label: 'Educators', hash: '#educators' },
  { id: 'pricing', label: 'Pricing', to: '/pricing' },
  {
    id: 'more',
    label: 'More',
    submenu: [
      { label: 'About Us', to: '/about', icon: Info },
      { label: 'Careers', to: '/careers', icon: Users },
      { label: 'Contact Us', to: '/contact', icon: FileText },
      { label: 'Help Center', to: '/help', icon: Sparkles },
    ],
  },
];

const HERO_BANNERS = [
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/ec18f90d-585e-4d27-9237-0cbd9e62d3f1.webp',
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/d6f9745e-4083-437b-b886-879034579237.webp',
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/e291d01c-b5bc-4367-a63c-b6f262c5655e.webp',
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/a4d6b0c7-a9ee-41a0-9bff-ee3dd71b69b4.webp',
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/1a8f2c04-d123-4efd-a9aa-891bc5c7cff2.webp',
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/c4f52ca7-4cbd-4968-b525-91e61319a312.webp',
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/47610d0d-f770-4e43-a45b-53dc32d4fcd3.webp',
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/b06ea640-505c-4a3a-82ae-cceb9590f0e7.webp',
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/3c7ab180-ca53-4a9f-abde-25493082ed25.webp',
  'https://static.pw.live/5eb393ee95fab7468a79d189/GLOBAL_CMS/6748dc2b-58dd-49b0-80cb-d93584eed655.webp',
];

const STATS = [
  { value: '50,000+', label: 'Active Students' },
  { value: '200+', label: 'Video Courses' },
  { value: '95%', label: 'Success Rate' },
  { value: '4.9★', label: 'App Rating' },
];

const YOUTUBE_VIDEOS = [
  { id: 'D-trM47JJrQ', title: 'Live Class: JEE Physics Core Concepts' },
  { id: 'WB6ojCSyFuo', title: 'Organic Chemistry Reaction Mechanisms' },
  { id: 'nsK8BgzxnJI', title: 'Calculus Made Easy for Mains & Advanced' },
  { id: '-LKTTS7B-rw', title: 'Inorganic Chemistry Tips & Shortcuts' },
  { id: 'AY2iynhUwVg', title: 'JEE Advanced Mock Test Strategy' },
];

const EDUCATORS = [
  { image: 'https://picsum.photos/seed/arunfc/200/200.jpg', name: 'Prof. Arun Sharma', subject: 'Physics', bio: 'IIT-Bombay \'08. 15 yrs teaching JEE Physics. 2000+ students with AIR <100.', students: '12,400' },
  { image: 'https://picsum.photos/seed/priyfc/200/200.jpg', name: 'Dr. Priya Verma', subject: 'Chemistry', bio: 'PhD IIT-Delhi. Known for organic chemistry shortcuts and visual teaching.', students: '9,800' },
  { image: 'https://picsum.photos/seed/rahfc/200/200.jpg', name: 'Rahul Iyer', subject: 'Mathematics', bio: 'IIT-Madras \'12. Makes calculus intuitive. 1800+ top-100 selections.', students: '11,200' },
];

const TESTIMONIALS = [
  { image: 'https://picsum.photos/seed/st1f/80/80.jpg', name: 'Aditya R.', text: 'LearnHub\'s structured approach changed everything. Went from 120 marks to 280 in JEE Mains in just 6 months.', rating: 5, tag: 'AIR 347 — JEE Advanced 2024' },
  { image: 'https://picsum.photos/seed/st2f/80/80.jpg', name: 'Sneha P.', text: 'The streak system and XP kept me motivated through tough months. Best investment my parents made.', rating: 5, tag: 'AIR 512 — JEE Advanced 2024' },
  { image: 'https://picsum.photos/seed/st3f/80/80.jpg', name: 'Rohan K.', text: 'Prof. Arun\'s mechanics course is legendary. Every concept felt like a story, not a formula.', rating: 5, tag: 'AIR 89 — JEE Advanced 2024' },
  { image: 'https://picsum.photos/seed/st4f/80/80.jpg', name: 'Meera J.', text: 'I loved the badge system. Getting the "Calculus King" badge after finishing the course felt amazing!', rating: 5, tag: 'AIR 210 — JEE Advanced 2024' },
  { image: 'https://picsum.photos/seed/st5f/80/80.jpg', name: 'Vikram S.', text: 'The refer & earn program got my whole friend group on LearnHub. We competed on the leaderboard daily.', rating: 5, tag: 'AIR 156 — JEE Advanced 2024' },
];

const FEATURES = [
  { icon: BookOpen, title: 'Structured Courses', desc: 'Subjects → Chapters → Parts. A clear roadmap so you never feel lost.' },
  { icon: Trophy, title: 'Earn XP & Badges', desc: 'Level up as you learn. Unlock 30+ badges and compete on the leaderboard.' },
  { icon: Flame, title: 'Daily Streaks', desc: 'Build an unbreakable study habit. Don\'t break the chain!' },
  { icon: Award, title: 'Coins & Rewards', desc: 'Redeem coins for mock tests, merch, and more.' },
  { icon: GraduationCap, title: 'Top Faculty', desc: 'IITians with 15+ years of JEE coaching experience.' },
  { icon: Users, title: 'Refer & Earn', desc: 'Both you and your friend get 20% off. Stack rewards!' },
  { icon: Target, title: 'Mock Tests & Analytics', desc: 'Full-length JEE mocks with detailed performance breakdowns.' },
  { icon: ShieldCheck, title: 'Certified Completion', desc: 'Get a verifiable certificate for every completed course.' },
  { icon: TrendingUp, title: 'Adaptive Difficulty', desc: 'Questions adapt to your level — basics to Olympiad-tier.' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Sign up free', desc: 'Create your account in 30 seconds. No credit card needed.', icon: Sparkles },
  { step: '02', title: 'Pick a course', desc: 'Browse structured JEE courses by subject and difficulty.', icon: BookOpen },
  { step: '03', title: 'Learn & earn XP', desc: 'Watch lessons, solve problems, build streaks, unlock badges.', icon: Zap },
  { step: '04', title: 'Crack the exam', desc: 'Track progress with analytics. Walk in confident.', icon: Trophy },
];

const FOOTER_LINKS = {
  quick: [
    { label: 'Courses', to: '/courses' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'About Us', to: '/about' },
    { label: 'Careers', to: '/careers' },
  ],
  support: [
    { label: 'Help Center', to: '/help' },
    { label: 'Contact Us', to: '/contact' },
    { label: 'FAQs', to: '/faqs' },
    { label: 'Privacy Policy', to: '/privacy' },
  ],
  legal: [
    { label: 'Terms of Service', to: '/terms' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Cookie Policy', to: '/cookies' },
    { label: 'Refund Policy', to: '/refund' },
  ],
};

/* ═══════════════════════════════════════════
   AUTO APP POPUP (Mobile Only)
   ═══════════════════════════════════════════ */
function AutoAppPopup({ onOpenApp }: { onOpenApp: () => void }) {
  const [open, setOpen] = useState(false);
  const platform = useRef(getPlatform());
  const hasShown = useRef(false);

  useEffect(() => {
    if (!isMobilePlatform()) return;
    if (hasShown.current) return;
    if (sessionStorage.getItem('lh_app_popup_shown')) return;

    const show = () => {
      if (hasShown.current) return;
      hasShown.current = true;
      sessionStorage.setItem('lh_app_popup_shown', '1');
      setOpen(true);
    };

    const scrollHandler = () => {
      if (window.scrollY > 400) show();
    };
    const timer = setTimeout(show, 3000);

    window.addEventListener('scroll', scrollHandler, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', scrollHandler);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const p = platform.current;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()} style={{ animation: 'fadeUp .35s ease-out both' }}>
        <button onClick={() => setOpen(false)} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition"><X className="w-4 h-4" /></button>
        <div className="px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4 mx-auto shadow-lg shadow-primary/25"><GraduationCap className="w-7 h-7 text-primary-foreground" /></div>
          <h3 className="text-lg font-bold mb-1">Open LearnHub App</h3>
          <p className="text-sm text-muted-foreground mb-5">
            {p === 'android' && 'Open in Google Play for the best experience on your Android device.'}
            {p === 'ios' && 'Open in App Store for the best experience on your iPhone or iPad.'}
            {p === 'other' && 'Download the LearnHub app for your device.'}
          </p>
          <div className="flex flex-col gap-2.5 mb-3">
            {p === 'android' && (
              <a href="https://play.google.com/store/apps/details?id=com.learnhub.app" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition active:scale-[0.98]">
                <Smartphone className="w-4 h-4" /> Open in Google Play
              </a>
            )}
            {p === 'ios' && (
              <a href="https://apps.apple.com/app/learnhub/id1234567890" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition active:scale-[0.98]">
                <Smartphone className="w-4 h-4" /> Open in App Store
              </a>
            )}
            {p === 'other' && (
              <a href="https://learnhub.app/download" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition active:scale-[0.98]">
                <Smartphone className="w-4 h-4" /> Get the App
              </a>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-muted">Continue on Web</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HOME HEADER
   ═══════════════════════════════════════════ */
function HomeHeader({ onOpenApp }: { onOpenApp: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => { setMenuOpen(false); setOpenSub(null); }, [location.pathname]);

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleHash = (hash: string) => {
    setMenuOpen(false);
    setOpenSub(null);
    const el = document.querySelector(hash);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const toggleSub = (id: string) => setOpenSub(prev => prev === id ? null : id);

  const navLinkClass = cn(
    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
    scrolled ? 'text-muted-foreground hover:text-foreground hover:bg-muted' : 'text-white/80 hover:text-white hover:bg-white/10'
  );

  return (
    <>
      <header data-home-header className={cn('fixed top-0 left-0 right-0 z-50 transition-all duration-300', scrolled ? 'bg-background/90 backdrop-blur-xl border-b border-border shadow-sm' : 'bg-transparent')}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center"><GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" /></div>
              <span className={cn('font-bold text-lg transition-colors', scrolled ? 'text-foreground' : 'text-white')}>LearnHub</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV_ITEMS.map(item => (
                item.submenu ? (
                  <div key={item.id} className="relative group">
                    <button className={cn('flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors', scrolled ? 'text-muted-foreground hover:text-foreground hover:bg-muted' : 'text-white/80 hover:text-white hover:bg-white/10')}>
                      {item.label}<ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-180" />
                    </button>
                    <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="bg-card border border-border rounded-xl shadow-xl p-1.5 min-w-[220px]">
                        {item.submenu.map(sub => (<Link key={sub.label} to={sub.to} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><sub.icon className="w-4 h-4 text-primary/70" />{sub.label}</Link>))}
                      </div>
                    </div>
                  </div>
                ) : item.to ? (
                  <Link key={item.id} to={item.to} className={navLinkClass}>
                    {item.label}
                  </Link>
                ) : (
                  <button key={item.id} onClick={() => item.hash ? handleHash(item.hash) : undefined} className={navLinkClass}>
                    {item.label}
                  </button>
                )
              ))}
            </nav>

            <div className="hidden lg:flex items-center gap-3">
              <Button asChild variant="ghost" size="sm" className={cn('text-sm font-medium', scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/90 hover:text-white hover:bg-white/10')}><Link to="/auth">Login / Register</Link></Button>
              <Button size="sm" className="text-sm gap-1.5" onClick={onOpenApp}><Smartphone className="w-3.5 h-3.5" />Get App</Button>
            </div>

            <button onClick={() => setMenuOpen(true)} className={cn('lg:hidden p-2 rounded-lg transition-colors', scrolled ? 'text-foreground hover:bg-muted' : 'text-white hover:bg-white/10')} aria-label="Open menu"><Menu className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <div className={cn('fixed inset-0 z-[55] lg:hidden transition-all duration-300', menuOpen ? 'visible' : 'invisible pointer-events-none')}>
        <div className={cn('absolute inset-0 bg-black/50 transition-opacity duration-300', menuOpen ? 'opacity-100' : 'opacity-0')} onClick={() => setMenuOpen(false)} />
        <div className={cn('absolute top-0 right-0 bottom-0 w-[85%] max-w-[360px] bg-card border-l border-border flex flex-col transition-transform duration-300 ease-out', menuOpen ? 'translate-x-0' : 'translate-x-full')}>
          <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
            <span className="font-bold text-lg">Menu</span>
            <button onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-muted transition" aria-label="Close menu"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto py-3 px-3 -mx-3">
            <div className="flex flex-col gap-2 px-2 mb-4">
              <Button asChild variant="outline" size="sm" className="w-full justify-center"><Link to="/auth">Login / Register</Link></Button>
              <Button size="sm" className="w-full justify-center gap-1.5" onClick={() => { setMenuOpen(false); onOpenApp(); }}><Smartphone className="w-3.5 h-3.5" />Get App</Button>
            </div>
            <div className="h-px bg-border mb-3" />
            <div className="space-y-0.5">
              {NAV_ITEMS.map(item => (
                <div key={item.id}>
                  {item.submenu ? (
                    <>
                      <button onClick={() => toggleSub(item.id)} className="flex items-center justify-between w-full px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                        {item.label}<ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', openSub === item.id && 'rotate-180')} />
                      </button>
                      <div className={cn('overflow-hidden transition-all duration-200', openSub === item.id ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0')}>
                        <div className="pl-4 ml-3 border-l-2 border-primary/20 space-y-0.5 py-1">
                          {item.submenu.map(sub => (<Link key={sub.label} to={sub.to} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><sub.icon className="w-4 h-4 text-primary/60" />{sub.label}</Link>))}
                        </div>
                      </div>
                    </>
                  ) : item.to ? (
                    <Link to={item.to} onClick={() => setMenuOpen(false)} className="flex items-center w-full px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <button onClick={() => item.hash ? handleHash(item.hash) : setMenuOpen(false)} className="flex items-center w-full px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                      {item.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 py-4 border-t border-border shrink-0"><p className="text-[11px] text-muted-foreground text-center">© {new Date().getFullYear()} LearnHub</p></div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════ */
function HomeFooter({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <footer className="border-t border-border bg-card/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-6">
          <div className="col-span-2 sm:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center"><GraduationCap className="w-4 h-4 text-primary-foreground" /></div><span className="font-bold text-lg">LearnHub</span></Link>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4 max-w-[220px]">India&apos;s next-gen learning platform. Structured courses, gamified progress, top educators.</p>
            <div className="flex gap-2">{['X', 'YT', 'IG'].map(s => (<a key={s} href="#" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition">{s}</a>))}</div>
          </div>
          <div><h4 className="font-semibold text-sm mb-3">Quick Links</h4><ul className="space-y-2">{FOOTER_LINKS.quick.map(l => (<li key={l.label}><Link to={l.to} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition">{l.label}</Link></li>))}</ul></div>
          <div><h4 className="font-semibold text-sm mb-3">Support</h4><ul className="space-y-2">{FOOTER_LINKS.support.map(l => (<li key={l.label}><Link to={l.to} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition">{l.label}</Link></li>))}</ul></div>
          
          <div>
            <h4 className="font-semibold text-sm mb-3">Get the App</h4>
            <div className="flex flex-col gap-2">
              <button onClick={onOpenApp} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-muted/50 transition text-left active:scale-[0.98]">
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-muted-foreground"><path d="M17.523 15.341a.996.996 0 0 0 0-1.992.996.996 0 0 0 0 1.992zm-11.046 0a.996.996 0 0 0 0-1.992.996.996 0 0 0 0 1.992zM17.94 8.5l1.8-3.12a.375.375 0 0 0-.65-.374l-1.824 3.16C15.742 7.614 14.018 7.082 12 7.082s-3.742.532-5.266 1.084L4.91 5.006a.375.375 0 0 0-.65.374L6.06 8.5C2.72 10.124.428 13.582 0 17.624h24c-.428-4.042-2.72-7.5-6.06-9.124z" fill="currentColor"/></svg>
                <div><div className="text-[10px] text-muted-foreground leading-none">Get it on</div><div className="text-xs font-semibold leading-tight mt-0.5">Google Play</div></div>
              </button>
              <button onClick={onOpenApp} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-muted/50 transition text-left active:scale-[0.98]">
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-muted-foreground"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="currentColor"/></svg>
                <div><div className="text-[10px] text-muted-foreground leading-none">Download on</div><div className="text-xs font-semibold leading-tight mt-0.5">App Store</div></div>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2"><p className="text-[11px] sm:text-xs text-muted-foreground">© {new Date().getFullYear()} LearnHub. All rights reserved.</p><div className="flex flex-wrap items-center gap-x-3 gap-y-1">{FOOTER_LINKS.legal.map(l => (<Link key={l.label} to={l.to} className="text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition">{l.label}</Link>))}</div></div></div>
    </footer>
  );
}

/* ═══════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════ */
const Home = () => {
  useSEO({
    title: 'LearnHub — Master JEE & Beyond with Top Educators',
    description: "India's next-gen learning platform with structured courses, gamified progress, badges, streaks, and certified instructors. Start free.",
    jsonLd: { '@context': 'https://schema.org', '@type': 'EducationalOrganization', name: 'LearnHub', description: 'Online learning platform for JEE, NEET, and competitive exams' },
  });

  const [appOpen, setAppOpen] = useState(false);
  const [visTesti, setVisTesti] = useState(1);
  const [testiIdx, setTestiIdx] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);
  
  const [trendingCourses, setTrendingCourses] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<typeof YOUTUBE_VIDEOS[0] | null>(null);

  // Smooth Scrolling Initialization (Lenis)
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  // Fetch only 3 trending courses from backend
  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, slug, thumbnail_url, instructor, price_inr, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(3);
      if (data) setTrendingCourses(data);
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const el = document.querySelector('header:not([data-home-header]), nav:not([data-home-header]), [data-navbar], [data-global-nav]') as HTMLElement | null;
    if (el) {
      const prev = el.style.display;
      el.style.display = 'none';
      return () => { el.style.display = prev; };
    }
  }, []);

  useEffect(() => {
    const u = () => setVisTesti(window.innerWidth >= 1024 ? 3 : 1);
    u();
    window.addEventListener('resize', u);
    return () => window.removeEventListener('resize', u);
  }, []);
  
  const maxTesti = Math.max(0, TESTIMONIALS.length - visTesti);

  // Hero Auto-Slide Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIdx(prev => (prev + 1) % HERO_BANNERS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const openApp = useCallback(() => {
    sessionStorage.removeItem('lh_app_popup_shown');
    setAppOpen(true);
  }, []);

  return (
    <div className="flex-1 overflow-x-hidden">
      <style>{`
        html.lenis, html.lenis body { height: auto; }
        .lenis.lenis-smooth { scroll-behavior: auto; }
        .lenis.lenis-smooth [data-lenis-prevent] { overflow: hidden; }
        .lenis.lenis-stopped { overflow: hidden; }
        .lenis.lenis-scrolling iframe { pointer-events: none; }
        
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scrollLeft { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-scroll-left { animation: scrollLeft 30s linear infinite; }
        .animate-scroll-left:hover { animation-play-state: paused; }
      `}</style>

      <HomeHeader onOpenApp={openApp} />
      <AutoAppPopup onOpenApp={openApp} />

      {appOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={() => setAppOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()} style={{ animation: 'fadeUp .3s ease-out both' }}>
            <button onClick={() => setAppOpen(false)} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition"><X className="w-4 h-4" /></button>
            <div className="px-6 py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4 mx-auto shadow-lg shadow-primary/25"><GraduationCap className="w-7 h-7 text-primary-foreground" /></div>
              <h3 className="text-lg font-bold mb-1">Open LearnHub App</h3>
              <p className="text-sm text-muted-foreground mb-5">Download the app for the best learning experience.</p>
              <a href="https://learnhub.app/download" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition active:scale-[0.98] mb-3">
                <Smartphone className="w-4 h-4" /> Download for Mobile
              </a>
              <button onClick={() => setAppOpen(false)} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-muted">Continue on Web</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ YOUTUBE VIDEO MODAL ═══════ */}
      {activeVideo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setActiveVideo(null)}>
          <div className="relative w-full max-w-4xl bg-card rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()} style={{ animation: 'fadeUp .3s ease-out both' }}>
            <button onClick={() => setActiveVideo(null)} className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"><X className="w-5 h-5" /></button>
            <div className="relative w-full aspect-video bg-black">
              <iframe 
                src={`https://www.youtube.com/embed/${activeVideo.id}?autoplay=1&rel=0`} 
                title={activeVideo.title} 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen 
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════ HERO BANNER SLIDER ═══════ */}
      <section className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '16/5' }}>
        <div 
          className="flex h-full transition-transform duration-700 ease-in-out will-change-transform"
          style={{ transform: `translateX(-${heroIdx * 100}%)` }}
        >
          {HERO_BANNERS.map((src, i) => (
            <div key={i} className="relative w-full h-full flex-shrink-0">
              <img 
                src={src} 
                alt="LearnHub Course Banner" 
                className="w-full h-full object-cover object-center" 
                loading={i === 0 ? 'eager' : 'lazy'} 
              />
            </div>
          ))}
        </div>
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent pointer-events-none z-[1]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none z-[1]" />

        {/* Navigation arrows */}
        <button 
          onClick={() => setHeroIdx(i => (i - 1 + HERO_BANNERS.length) % HERO_BANNERS.length)} 
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-[2] p-2 sm:p-2.5 rounded-full bg-black/30 text-white hover:bg-black/60 transition backdrop-blur-sm border border-white/10" 
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setHeroIdx(i => (i + 1) % HERO_BANNERS.length)} 
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-[2] p-2 sm:p-2.5 rounded-full bg-black/30 text-white hover:bg-black/60 transition backdrop-blur-sm border border-white/10" 
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dot indicators */}
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-[2]">
          {HERO_BANNERS.map((_, i) => (
            <button 
              key={i} 
              onClick={() => setHeroIdx(i)}
              className={cn('h-1.5 rounded-full transition-all duration-300', i === heroIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80')}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={s.label} className={cn('px-4 py-5 sm:py-6 text-center', i < 3 && 'border-r border-border', i < 2 && 'border-b md:border-b-0 border-border')}>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary">{s.value}</div>
              <div className="text-[11px] sm:text-xs md:text-sm text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ TRENDING COURSES (ONLY 3 FROM BACKEND) ═══════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-8">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1 block">Popular</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Trending Courses</h2>
            </div>
            <Button asChild variant="ghost" className="hidden sm:inline-flex gap-1 text-muted-foreground hover:text-foreground self-start sm:self-auto">
              <Link to="/courses">View all <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {trendingCourses.length === 0 && [1,2,3].map(i => (
              <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
            ))}
            {trendingCourses.slice(0, 3).map(c => (
              <Link key={c.id} to={`/courses/${c.slug}`} className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {c.thumbnail_url ? <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-8 h-8 text-muted-foreground/20" /></div>}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/5 transition-colors" />
                  {c.price_inr === 0 && <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm bg-green-500/20 text-green-400">Free</span>}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="p-2.5 sm:p-3 rounded-full bg-primary/90 text-white shadow-lg"><Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" fill="white" /></div>
                  </div>
                </div>
                <div className="p-3.5 sm:p-4">
                  <h3 className="font-semibold text-sm leading-snug mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">{c.title}</h3>
                  {c.instructor && <p className="text-xs text-muted-foreground mb-2.5">{c.instructor}</p>}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-primary">{c.price_inr > 0 ? formatPriceINR(c.price_inr) : 'Free Access'}</span>
                    {c.created_at && (
                      <span className="text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center sm:hidden">
            <Button asChild variant="outline" size="sm" className="gap-1"><Link to="/courses">View all courses <ArrowRight className="w-3.5 h-3.5" /></Link></Button>
          </div>
        </div>
      </section>

      {/* ═══════ YOUTUBE FEATURED VIDEOS SLIDER ═══════ */}
      <section className="py-14 sm:py-20 border-t border-border bg-muted/30 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 sm:mb-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1 block">Live & Recorded</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Featured Classes</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <YoutubeIcon className="w-4 h-4 text-red-500" /> Watch on YouTube
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="flex gap-4 sm:gap-5 animate-scroll-left w-max">
            {[...YOUTUBE_VIDEOS, ...YOUTUBE_VIDEOS].map((v, i) => (
              <button
                key={i}
                onClick={() => setActiveVideo(v)}
                className="relative w-[280px] sm:w-[320px] lg:w-[360px] flex-shrink-0 rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 group/vid"
              >
                <div className="relative aspect-video overflow-hidden bg-black">
                  <img 
                    src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`} 
                    alt={v.title} 
                    className="w-full h-full object-cover group-hover/vid:scale-105 transition-transform duration-500 brightness-90 group-hover/vid:brightness-100" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover/vid:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-red-600/90 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/20 group-hover/vid:scale-110 transition-transform duration-300">
                      <Play className="w-6 h-6 text-white fill-white ml-1" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ WHY LEARNHUB ═══════ */}
      <section id="features" className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1 block">Features</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3">Why 50,000+ students choose LearnHub</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">Everything you need to stay consistent, learn deeply, and crack competitive exams.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 sm:p-6 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors group">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-primary/20 transition-colors"><Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /></div>
                <h3 className="font-semibold text-sm sm:text-base mb-1">{title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1 block">Process</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">How it works</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {HOW_IT_WORKS.map(({ step, title, desc, icon: Icon }, i) => (
              <div key={step} className="relative text-center">
                {i < HOW_IT_WORKS.length - 1 && <div className="hidden lg:block absolute top-[28px] left-[58%] w-[84%] h-px border-t border-dashed border-border" />}
                <div className="relative inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-card border border-border mb-3 sm:mb-4">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-[9px] sm:text-[10px] font-bold text-primary-foreground flex items-center justify-center">{step}</span>
                </div>
                <h3 className="font-semibold text-sm sm:text-base mb-0.5 sm:mb-1">{title}</h3>
                <p className="text-[11px] sm:text-sm text-muted-foreground leading-relaxed px-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ EDUCATORS ═══════ */}
      <section id="educators" className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1 block">Faculty</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3">Learn from the best</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">IIT alumni with proven track records. Not influencers — real educators.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {EDUCATORS.map(e => (
              <div key={e.name} className="p-5 sm:p-6 rounded-xl bg-card border border-border text-center hover:border-primary/40 transition-colors">
                <img src={e.image} alt={e.name} className="w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-full mx-auto mb-3 sm:mb-4 object-cover ring-2 ring-primary/20 ring-offset-2 ring-offset-card" loading="lazy" />
                <h3 className="font-semibold text-base sm:text-lg">{e.name}</h3>
                <span className="inline-block text-[11px] font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full mt-1 mb-2.5 sm:mb-3">{e.subject}</span>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2.5 sm:mb-3 leading-relaxed">{e.bio}</p>
                <div className="text-[11px] sm:text-xs text-muted-foreground flex items-center justify-center gap-1"><Users className="w-3 h-3" /> {e.students} students</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-border bg-muted/30 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1 block">Testimonials</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Students love LearnHub</h2>
          </div>
          <div className="relative">
            <div className="overflow-hidden">
              <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${(testiIdx / TESTIMONIALS.length) * 100}%)` }}>
                {TESTIMONIALS.map(t => (
                  <div key={t.name} className="w-full flex-shrink-0 px-1 sm:px-2" style={{ maxWidth: `${100 / visTesti}%`, flexBasis: `${100 / visTesti}%` }}>
                    <div className="p-5 sm:p-7 lg:p-8 rounded-2xl bg-card border border-border text-center h-full flex flex-col">
                      <div className="flex justify-center gap-0.5 mb-3 sm:mb-4">
                        {Array.from({ length: t.rating }).map((_, i) => (<Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 fill-yellow-500" />))}
                      </div>
                      <p className="text-sm sm:text-base text-foreground/90 leading-relaxed mb-4 sm:mb-5 flex-1">&ldquo;{t.text}&rdquo;</p>
                      <img src={t.image} alt={t.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full mx-auto mb-2 sm:mb-3 object-cover" loading="lazy" />
                      <div className="font-semibold text-xs sm:text-sm">{t.name}</div>
                      <div className="text-[10px] sm:text-xs text-primary mt-0.5">{t.tag}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 sm:gap-3 mt-6 sm:mt-8">
              <button onClick={() => setTestiIdx(i => Math.max(0, i - 1))} disabled={testiIdx === 0} className="p-2 rounded-full border border-border hover:border-primary/40 hover:bg-card transition disabled:opacity-30 disabled:pointer-events-none active:scale-95" aria-label="Previous"><ChevronLeft className="w-4 h-4" /></button>
              <div className="flex gap-1.5">{Array.from({ length: maxTesti + 1 }).map((_, i) => (<button key={i} onClick={() => setTestiIdx(i)} className={cn('h-1.5 rounded-full transition-all duration-300', i === testiIdx ? 'w-6 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground')} />))}</div>
              <button onClick={() => setTestiIdx(i => Math.min(maxTesti, i + 1))} disabled={testiIdx >= maxTesti} className="p-2 rounded-full border border-border hover:border-primary/40 hover:bg-card transition disabled:opacity-30 disabled:pointer-events-none active:scale-95" aria-label="Next"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ TRUST ═══════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-10 sm:py-12 border-t border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border"><ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" /><div><div className="font-medium text-sm">Secure Payments</div><div className="text-xs text-muted-foreground mt-0.5">256-bit SSL encryption.</div></div></div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border"><Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" /><div><div className="font-medium text-sm">Instant Access</div><div className="text-xs text-muted-foreground mt-0.5">Start learning immediately after enrollment.</div></div></div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_hsl(0_100%_50%/0.1),_transparent_70%)] pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">Ready to crack <span className="text-primary">JEE</span>?</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-lg mx-auto">Join 50,000+ students leveling up every day. Start free — no credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="text-sm sm:text-base gap-2 px-6 sm:px-8"><Link to="/auth">Get started free <ArrowRight className="w-4 h-4" /></Link></Button>
            <Button size="lg" className="text-sm sm:text-base gap-2 px-6 sm:px-8 border border-border bg-card hover:bg-muted text-foreground transition-colors" onClick={openApp}>
              <Smartphone className="w-4 h-4" /> Open in App
            </Button>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
            <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3 text-primary" /> Free forever plan</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3 text-primary" /> No credit card</span>
          </p>
        </div>
      </section>

      <HomeFooter onOpenApp={openApp} />
    </div>
  );
};

export default Home;