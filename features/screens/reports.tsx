"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FacetFilter, matchesDateRange, matchesSearch, matchesSelected, rowDate, TableFilters, uniqueFilterOptions } from "@/components/table-filters";
import { asList, wa } from "@/lib/wa";
import { DataTable, ErrorNote, LoadingBlock, PageHeading, RefreshButton, StatGrid, StatusBadge, useResource } from "@/features/shared";

const REPORTS: Record<string, { title: string; path: string; list?: string }> = {
  "/reports/broadcast": { title: "Broadcast report", path: "/broadcast/logs?limit=500" },
  "/reports/single-messages": { title: "Single message report", path: "/broadcast/logs?limit=500&campaignName=Single%20Message" },
  "/reports/delivery": { title: "Delivery report", path: "/reports/delivery?days=90", list: "dailyData" },
  "/reports/campaign": { title: "Campaign performance", path: "/reports/campaign-performance?period=year", list: "campaigns" },
  "/reports/contacts": { title: "Contact analytics", path: "/contact-analytics/reports" },
  "/reports/lead-assignments": { title: "Lead assignments", path: "/lead-management/reports/assignments" },
  "/reports/user-activity": { title: "Team activity", path: "/lead-management/reports/activity-logs" },
  "/reports/blocked": { title: "Blocked contacts", path: "/reports/blocked-contacts", list: "contacts" },
  "/report-dripcampaign": { title: "Drip campaign report", path: "/reports/drip-campaigns" },
  "/reports/whatsapp-flows": { title: "WhatsApp flow report", path: "/webhook/whatsapp/flows/reports" },
  "/fblead-automation-report": { title: "Facebook lead automation", path: "/fb-automation/leads" },
  "/reports/user-engagement": { title: "User engagement", path: "/reports/enhanced-dashboard?period=month" },
  "/reports": { title: "Delivery report", path: "/reports/delivery?days=90", list: "dailyData" },
};

const LIST_KEYS = ["campaigns", "campaignStats", "templatePerformance", "dailyData", "dailyStats", "rows", "logs", "leads", "contacts", "assignments", "items", "data"];

function reportRows(payload: any, preferred?: string) {
  if (Array.isArray(payload)) return payload;
  if (preferred && Array.isArray(payload?.[preferred])) return payload[preferred];
  for (const key of LIST_KEYS) {
    if (Array.isArray(payload?.[key]) && payload[key].length) return payload[key];
  }
  for (const key of LIST_KEYS) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return asList(payload);
}

const SKIPPED_COLUMNS = new Set(["_id", "__v", "userId", "senderId", "id"]);
const COLUMN_LABELS: Record<string, string> = {
  campaignName: "Campaign",
  contactName: "Contact",
  contactPhone: "Phone",
  messageType: "Type",
  templateName: "Template",
  status: "Status",
  createdAt: "Created",
  message: "Message",
  name: "Name",
  phone: "Phone",
  category: "Category",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  deliveryRate: "Delivery %",
  readRate: "Read %",
  cost: "Cost",
};
const PREFERRED_COLUMNS = ["campaignName", "name", "contactName", "contactPhone", "phone", "messageType", "templateName", "status", "sent", "delivered", "read", "failed", "deliveryRate", "message", "category", "createdAt"];

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function columnsFor(rows: Record<string, any>[]) {
  const sample = rows[0] || {};
  const usable = (key: string) => !SKIPPED_COLUMNS.has(key) && ["string", "number", "boolean"].includes(typeof sample[key]);
  const preferred = PREFERRED_COLUMNS.filter((key) => key in sample && usable(key));
  const rest = Object.keys(sample).filter((key) => usable(key) && !preferred.includes(key));
  const columns = [...preferred, ...rest].slice(0, 6).map((key) => ({
    key,
    label: COLUMN_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (char: string) => char.toUpperCase()),
    render: key === "status" ? (row: Record<string, any>) => <StatusBadge value={String(row.status || "—")} /> : undefined,
  }));
  return columns;
}

export function ReportScreen({ pathname }: { pathname: string }) {
  const config = REPORTS[pathname] || REPORTS["/reports"];
  const resource = useResource(async () => {
    const data = await wa(config.path);
    if (config.list === "campaigns" && reportRows(data, "campaigns").length === 0) {
      const logs = asList(await wa("/broadcast/logs?limit=500").catch(() => []));
      const grouped = new Map<string, Record<string, any>>();
      for (const log of logs) {
        const name = String(log.campaignName || "Unknown");
        const current = grouped.get(name) || { name, sent: 0, delivered: 0, read: 0, failed: 0, status: log.status };
        current.sent += 1;
        if (log.status === "delivered" || log.status === "read") current.delivered += 1;
        if (log.status === "read") current.read += 1;
        if (log.status === "failed") current.failed += 1;
        grouped.set(name, current);
      }
      return { ...data, campaigns: [...grouped.values()] };
    }
    return data;
  }, [config.path, config.list]);
  const rows = reportRows(resource.data, config.list);
  const summary = resource.data?.summary;

  return (
    <div className="space-y-4">
      <PageHeading title={config.title} description="Search, filter by date and status, then open Details on any row." actions={<RefreshButton onClick={resource.reload} pending={resource.loading} />} />
      {resource.error ? <ErrorNote message={resource.error} /> : null}
      {summary && typeof summary === "object" ? (
        <StatGrid items={Object.entries(summary).filter(([, value]) => ["string", "number"].includes(typeof value)).slice(0, 4).map(([label, value]) => ({ label, value: String(value ?? 0) }))} />
      ) : null}
      {pathname === "/reports/contacts" ? (
        <Button variant="outline" onClick={async () => { await wa("/contact-analytics/analyze-all", { method: "POST" }); resource.reload(); }}>Analyze contacts</Button>
      ) : null}
      {resource.loading ? <LoadingBlock /> : <DataTable rows={rows} columns={columnsFor(rows)} searchPlaceholder="Search this report" empty="No report data for this account yet" />}
    </div>
  );
}

export function UsageScreen({ type }: { type: "messages" | "templates" | "pricing" }) {
  const resource = useResource(() => wa(`/usage/${type}?limit=200`), [type]);
  const rows = asList(resource.data?.rows);
  const summary = resource.data?.summary || {};
  return (
    <div className="space-y-4">
      <PageHeading title={type === "pricing" ? "Pricing usage" : type === "templates" ? "Template usage" : "Message usage"} actions={<RefreshButton onClick={resource.reload} pending={resource.loading} />} />
      <StatGrid items={Object.entries(summary).filter(([, value]) => ["string", "number"].includes(typeof value)).slice(0, 4).map(([label, value]) => ({ label, value: String(value ?? 0) }))} />
      {resource.error ? <ErrorNote message={resource.error} /> : null}
      {resource.loading ? <LoadingBlock /> : <DataTable rows={rows} columns={columnsFor(rows)} searchPlaceholder="Search usage" empty="No usage rows yet" />}
    </div>
  );
}
