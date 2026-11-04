"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  ChevronDown,
  Clock,
  Facebook,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
  UserCog,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  href: string;
  icon?: typeof LayoutDashboard;
  children?: Array<{ label: string; href: string }>;
};

const NAV: Item[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "24-hour window", href: "/inbox/window", icon: Clock },
  { label: "Inbox", href: "/inbox", icon: MessageSquare },
  { label: "WhatsApp flows", href: "/whatsapp-flows", icon: Workflow },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: Megaphone,
    children: [
      { label: "Broadcasts", href: "/campaigns/broadcast" },
      { label: "Single messages", href: "/campaigns/past" },
      { label: "Schedule", href: "/campaigns/schedule" },
      { label: "Campaign manager", href: "/campaigns/manager" },
    ],
  },
  {
    label: "Automation",
    href: "/automation/dashboard",
    icon: GitBranch,
    children: [
      { label: "Overview", href: "/automation/dashboard" },
      { label: "Facebook lead automation", href: "/automation/triggers" },
      { label: "Drip campaigns", href: "/automation/campaigns" },
      { label: "Interest lists", href: "/automation/interest" },
      { label: "Flows", href: "/automation/flows" },
      { label: "Segments", href: "/automation/segments" },
    ],
  },
  {
    label: "Templates",
    href: "/templates",
    icon: FileText,
    children: [
      { label: "Add template", href: "/templates/add" },
      { label: "Manage templates", href: "/templates/manage" },
      { label: "Meta status", href: "/templates/status" },
    ],
  },
  {
    label: "Usage",
    href: "/usage/messages",
    icon: Gauge,
    children: [
      { label: "Message usage", href: "/usage/messages" },
      { label: "Template usage", href: "/usage/templates" },
      { label: "Pricing usage", href: "/usage/pricing" },
    ],
  },
  {
    label: "AI agent",
    href: "/ai/agents",
    icon: Bot,
    children: [
      { label: "All agents", href: "/ai/agents" },
      { label: "New agent", href: "/ai/new" },
      { label: "Pre-filled text", href: "/ai/prefilled" },
      { label: "Map agent", href: "/ai/map" },
      { label: "Agent reports", href: "/ai/reports" },
    ],
  },
  {
    label: "Facebook",
    href: "/facebook/forms",
    icon: Facebook,
    children: [
      { label: "Lead forms", href: "/facebook/forms" },
      { label: "Leads", href: "/facebook/leads" },
    ],
  },
  {
    label: "Reports",
    href: "/reports/broadcast",
    icon: BarChart3,
    children: [
      { label: "Broadcast report", href: "/reports/broadcast" },
      { label: "Single message report", href: "/reports/single-messages" },
      { label: "Delivery", href: "/reports/delivery" },
      { label: "Campaign performance", href: "/reports/campaign" },
      { label: "Contact analytics", href: "/reports/contacts" },
      { label: "Lead assignments", href: "/reports/lead-assignments" },
      { label: "Team activity", href: "/reports/user-activity" },
      { label: "Blocked contacts", href: "/reports/blocked" },
      { label: "Drip campaigns", href: "/report-dripcampaign" },
      { label: "WhatsApp flow report", href: "/reports/whatsapp-flows" },
      { label: "Facebook automation", href: "/fblead-automation-report" },
      { label: "User engagement", href: "/reports/user-engagement" },
    ],
  },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "User management", href: "/user-management", icon: UserCog },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { label: "Account", href: "/settings" },
      { label: "Profile", href: "/settings/profile" },
      { label: "Webhook and API", href: "/settings/api" },
      { label: "Webhook events", href: "/settings/webhook-events" },
    ],
  },
];

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceNav() {
  const pathname = usePathname();
  const activeGroup = NAV.find((item) => item.children?.some((child) => active(pathname, child.href)))?.label || null;
  const [openLabel, setOpenLabel] = useState<string | null>(activeGroup);

  useEffect(() => {
    setOpenLabel(activeGroup);
  }, [pathname, activeGroup]);

  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const expanded = openLabel === item.label;
        if (!item.children) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
                active(pathname, item.href) && "bg-muted font-medium text-foreground"
              )}
            >
              {Icon ? <Icon className="size-4" /> : null}
              {item.label}
            </Link>
          );
        }
        return (
          <div key={item.label}>
            <button
              type="button"
              onClick={() => setOpenLabel((current) => (current === item.label ? null : item.label))}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {Icon ? <Icon className="size-4" /> : null}
              <span className="flex-1">{item.label}</span>
              <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded ? (
              <div className="ml-6 space-y-0.5 border-l pl-2">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                      pathname === child.href && "bg-muted font-medium text-foreground"
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
