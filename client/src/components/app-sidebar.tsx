import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Users,
  ArrowLeftRight, Building2, LogOut, Settings
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "לוח בקרה", url: "/", icon: LayoutDashboard },
  { title: "לקוחות", url: "/clients", icon: Users },
  { title: "תנועות", url: "/transactions", icon: ArrowLeftRight },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sidebar side="right">
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">TaxPro CRM</h2>
              <p className="text-xs text-muted-foreground">מערכת ניהול</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>ניווט</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const isActive = item.url === "/"
                  ? location === "/"
                  : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "") || "dashboard"}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        {user && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground truncate" data-testid="text-sidebar-user">
                {user.fullName}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    data-testid="link-settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          TaxPro CRM v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
