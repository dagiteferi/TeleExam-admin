import { Outlet, useNavigate } from "react-router-dom";
import {
  Activity, BookOpen, Bot, ClipboardCheck, CreditCard, GraduationCap, History, LayoutDashboard, Link2, LogOut,
  Megaphone, Settings, ShieldCheck, Users, ArrowLeft,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import type { Role } from "./api";
import { useG12Auth } from "./auth";

const NAV: { title: string; url: string; icon: React.ElementType; role: Role }[] = [
  { title: "Dashboard", url: "/12", icon: LayoutDashboard, role: "viewer" },
  { title: "Students", url: "/12/students", icon: Users, role: "viewer" },
  { title: "Payments", url: "/12/payments", icon: CreditCard, role: "admin" },
  { title: "Settings", url: "/12/settings", icon: Settings, role: "admin" },
  { title: "Promo Links", url: "/12/promo", icon: Link2, role: "admin" },
  { title: "Announcements", url: "/12/announcements", icon: Megaphone, role: "admin" },
  { title: "AI Tutor", url: "/12/ai", icon: Bot, role: "admin" },
  { title: "Content", url: "/12/content", icon: BookOpen, role: "editor" },
  { title: "Review Queue", url: "/12/review", icon: ClipboardCheck, role: "editor" },
  { title: "Audit Log", url: "/12/audit", icon: History, role: "admin" },
  { title: "System", url: "/12/system", icon: Activity, role: "viewer" },
  { title: "Admins", url: "/12/admins", icon: ShieldCheck, role: "owner" },
];

function G12Sidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { can } = useG12Auth();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-base tracking-tight">TeleExam 12</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Grade 12</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.filter((item) => can(item.role)).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/12"} className="hover:bg-sidebar-accent/50"
                             activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" className="hover:bg-sidebar-accent/50" activeClassName="">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Exit exam panel</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function G12Layout() {
  const { admin, logout } = useG12Auth();
  const navigate = useNavigate();
  const signOut = async () => {
    await logout();
    navigate("/12/login");
  };
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <G12Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 gap-4 sticky top-0 z-10">
            <SidebarTrigger className="flex-shrink-0" />
            <div className="flex items-center gap-3 ml-auto">
              <Badge className="capitalize hidden sm:inline-flex">{admin?.role}</Badge>
              <span className="text-sm text-muted-foreground hidden md:inline truncate max-w-[220px]">{admin?.email}</span>
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
