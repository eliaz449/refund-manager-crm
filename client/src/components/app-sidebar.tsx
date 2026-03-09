import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Users, Briefcase, CheckSquare, CreditCard,
  ArrowLeftRight, Building2
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

const mainItems = [
  { title: "לוח בקרה", url: "/", icon: LayoutDashboard },
  { title: "לקוחות", url: "/clients", icon: Users },
  { title: "תיקים", url: "/cases", icon: Briefcase },
  { title: "משימות", url: "/tasks", icon: CheckSquare },
  { title: "תשלומים", url: "/payments", icon: CreditCard },
  { title: "תנועות", url: "/transactions", icon: ArrowLeftRight },
];

export function AppSidebar() {
  const [location] = useLocation();

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
      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground">
          TaxPro CRM v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
