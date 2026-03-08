import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft,
  Globe, FileText, GitCompare, Calendar, History,
  Brain, Play, BarChart2, Wrench,
  Trophy, Package, Award,
  Shield, Video, Monitor, UserCheck, AlertOctagon,
  BookOpen, Mail, CheckSquare, Settings2,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    ],
  },
  {
    title: "Quizy",
    items: [
      { icon: Globe, label: "Połączenia WP", path: "/connections" },
      { icon: FileText, label: "Quizy i Snapshoty", path: "/quizzes" },
      { icon: GitCompare, label: "Porównaj snapshoty", path: "/diff" },
      { icon: Globe, label: "Strona testowa WP", path: "/test-page" },
      { icon: Calendar, label: "Harmonogram", path: "/scheduler" },
      { icon: History, label: "Historia Quizu", path: "/quiz-history" },
    ],
  },
  {
    title: "Symulacje i QA",
    items: [
      { icon: Brain, label: "Analizy AI", path: "/reviews" },
      { icon: Play, label: "Symulacje", path: "/simulations" },
      { icon: BarChart2, label: "Raporty", path: "/reports" },
      { icon: Wrench, label: "Poprawki", path: "/patches", badge: true },
    ],
  },
  {
    title: "Wyniki i Nagrody",
    items: [
      { icon: Trophy, label: "Wyniki Finalne", path: "/contest-results" },
      { icon: Award, label: "Dyplomy", path: "/diplomas" },
      { icon: Package, label: "Konkurs Offline", path: "/offline-contest" },
    ],
  },
  {
    title: "Weryfikacja",
    items: [
      { icon: Shield, label: "Audyt Ustawień", path: "/settings-audit" },
      { icon: Video, label: "Weryfikator Nagrań", path: "/video-verifier" },
      { icon: Monitor, label: "Przeglądarka Quizu", path: "/quiz-browser" },
      { icon: UserCheck, label: "Profile Behawioralne", path: "/behavioral-profiles" },
      { icon: AlertOctagon, label: "Anomalie Techniczne", path: "/anomaly-detector" },
    ],
  },
  {
    title: "Administracja",
    items: [
      { icon: BookOpen, label: "Baza Ryzyk", path: "/risk-kb" },
      { icon: Mail, label: "Import MailerLite", path: "/mailerlite" },
      { icon: CheckSquare, label: "Checklista Pre-Contest", path: "/pre-contest" },
      { icon: Settings2, label: "Ustawienia", path: "/settings" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Zaloguj się aby kontynuować
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Dostęp do panelu wymaga uwierzytelnienia.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Zaloguj się
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: pendingCount } = trpc.export.pendingPatchesCount.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 15000 }
  );
  const pendingBadge = (pendingCount?.pending ?? 0) + (pendingCount?.approved ?? 0);
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const activeItem = navSections.flatMap(s => s.items).find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <span className="font-semibold tracking-tight truncate text-sm">
                  Quiz Manager
                </span>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            {navSections.map((section, si) => (
              <div key={si} className={si > 0 ? "mt-1" : ""}>
                {section.title && !isCollapsed && (
                  <div className="px-4 py-1.5 mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {section.title}
                    </p>
                  </div>
                )}
                {section.title && isCollapsed && si > 0 && (
                  <div className="mx-3 my-1 border-t border-border/40" />
                )}
                <SidebarMenu className="px-2 py-0.5">
                  {section.items.map(item => {
                    const isActive = location === item.path;
                    const badge = item.badge && pendingBadge > 0 ? pendingBadge : 0;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-9 transition-all font-normal"
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {badge > 0 && (
                            <span className="ml-auto text-xs bg-yellow-500 text-black font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                              {badge}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">{user?.email || "-"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Wyloguj</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground">{activeItem?.label ?? "Menu"}</span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
