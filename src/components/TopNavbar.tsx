import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopNavbar() {
  const { user, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 gap-4 sticky top-0 z-10">
      <SidebarTrigger className="flex-shrink-0" />
      <div className="flex items-center gap-3 ml-auto">
        <Badge variant={isSuperAdmin ? "default" : "secondary"} className="hidden sm:inline-flex">
          {isSuperAdmin ? "Superadmin" : "Admin"}
        </Badge>
        <span className="text-sm text-muted-foreground hidden md:inline truncate max-w-[200px]">
          {user?.email}
        </span>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
