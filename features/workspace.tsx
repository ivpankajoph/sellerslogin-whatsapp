"use client";

import { usePathname } from "next/navigation";
import { DashboardScreen, SetupScreen, useAccountStatus } from "@/features/screens/home";
import { InboxScreen } from "@/features/screens/inbox";
import { BroadcastScreen, CampaignManagerScreen, ContactsScreen, ScheduleScreen, SettingsScreen, SingleMessageScreen, TemplatesScreen, UsersScreen } from "@/features/screens/records";
import { AutomationHome, DripScreen, FlowListScreen, InterestScreen, MetaFlowsScreen, SegmentsScreen, TriggersScreen } from "@/features/screens/automation";
import { ReportScreen, UsageScreen } from "@/features/screens/reports";
import { AgentReportsScreen, AgentsScreen, FacebookScreen, MapAgentScreen, NewAgentScreen, PrefilledScreen } from "@/features/screens/intelligence";
import { ErrorNote, LoadingBlock, PageHeading } from "@/features/shared";

export function Workspace() {
  const pathname = usePathname();
  const account = useAccountStatus();

  if (account.loading) return <LoadingBlock label="Checking WhatsApp account" />;
  if (account.error) return <ErrorNote message={account.error} />;
  if (!account.data?.connected && pathname !== "/settings" && !pathname.startsWith("/settings/")) {
    return (
      <div className="space-y-4">
        <PageHeading title="Connect WhatsApp" description="This seller workspace uses the same WhatsApp account stored in SellersLogin." />
        <SetupScreen onConnected={account.reload} />
      </div>
    );
  }

  if (pathname === "/") return <DashboardScreen />;
  if (pathname === "/inbox" || pathname === "/inbox/leads") return <InboxScreen mode="inbox" />;
  if (pathname === "/inbox/window") return <InboxScreen mode="window" />;
  if (pathname === "/whatsapp-flows") return <MetaFlowsScreen />;
  if (pathname === "/campaigns" || pathname === "/campaigns/broadcast") return <BroadcastScreen />;
  if (pathname === "/campaigns/past") return <SingleMessageScreen />;
  if (pathname === "/campaigns/schedule") return <ScheduleScreen />;
  if (pathname === "/campaigns/manager") return <CampaignManagerScreen />;
  if (pathname === "/automation" || pathname === "/automation/dashboard") return <AutomationHome />;
  if (pathname === "/automation/triggers") return <TriggersScreen />;
  if (pathname === "/automation/campaigns" || pathname === "/automation/drip") return <DripScreen />;
  if (pathname === "/automation/interest") return <InterestScreen />;
  if (pathname === "/automation/flows" || pathname.startsWith("/automation/flows/")) return <FlowListScreen />;
  if (pathname === "/automation/segments") return <SegmentsScreen />;
  if (pathname === "/templates" || pathname === "/templates/manage") return <TemplatesScreen view="manage" />;
  if (pathname === "/templates/add") return <TemplatesScreen view="add" />;
  if (pathname === "/templates/status") return <TemplatesScreen view="status" />;
  if (pathname === "/usage/messages") return <UsageScreen type="messages" />;
  if (pathname === "/usage/templates") return <UsageScreen type="templates" />;
  if (pathname === "/usage/pricing") return <UsageScreen type="pricing" />;
  if (pathname === "/ai" || pathname === "/ai/agents" || pathname === "/ai/manage") return <AgentsScreen />;
  if (pathname === "/ai/new") return <NewAgentScreen />;
  if (pathname === "/ai/prefilled") return <PrefilledScreen />;
  if (pathname === "/ai/map") return <MapAgentScreen />;
  if (pathname === "/ai/reports") return <AgentReportsScreen />;
  if (pathname === "/facebook/forms" || pathname === "/facebook") return <FacebookScreen kind="forms" />;
  if (pathname === "/facebook/leads") return <FacebookScreen kind="leads" />;
  if (pathname === "/contacts") return <ContactsScreen />;
  if (pathname === "/user-management" || pathname === "/user-management-dashboard") return <UsersScreen />;
  if (pathname === "/settings") return <SettingsScreen section="account" />;
  if (pathname === "/settings/profile") return <SettingsScreen section="profile" />;
  if (pathname === "/settings/api") return <SettingsScreen section="api" />;
  if (pathname === "/settings/webhook-events") return <SettingsScreen section="events" />;
  if (pathname.startsWith("/reports") || pathname === "/report-dripcampaign" || pathname === "/fblead-automation-report") {
    return <ReportScreen pathname={pathname} />;
  }
  return <DashboardScreen />;
}
