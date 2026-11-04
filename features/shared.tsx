"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FacetFilter, matchesDateRange, matchesSearch, matchesSelected, rowDate, TableFilters, uniqueFilterOptions } from "@/components/table-filters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function StatusBadge({ value }: { value?: string }) {
  const status = String(value || "unknown").toLowerCase();
  const tone = status.includes("fail") || status.includes("reject") || status.includes("block")
    ? "border-red-200 bg-red-50 text-red-700"
    : status.includes("read")
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : status.includes("deliver") || status.includes("approv") || status.includes("success") || status.includes("active")
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : status.includes("pending") || status.includes("queue") || status.includes("sent") || status.includes("draft")
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-border bg-muted text-foreground";
  return <Badge variant="outline" className={tone}>{value || "—"}</Badge>;
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatGrid({ items }: { items: Array<{ label: string; value: ReactNode; hint?: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-2xl">{item.value}</CardTitle>
          </CardHeader>
          {item.hint ? <CardContent className="text-xs text-muted-foreground">{item.hint}</CardContent> : null}
        </Card>
      ))}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{label}</div>;
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</div>;
}

export function RefreshButton({ onClick, pending }: { onClick: () => void; pending?: boolean }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      <RefreshCw className={pending ? "animate-spin" : ""} />
      Refresh
    </Button>
  );
}

function cellText(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const text = value.map((item) => (item == null || typeof item === "object" ? "" : String(item))).filter(Boolean).join(", ");
    return text || "—";
  }
  return "—";
}

const HIDDEN_DETAIL_KEYS = new Set(["_id", "__v", "userId", "senderId"]);

function rowSearchValues(row: Record<string, any>) {
  return Object.entries(row)
    .filter(([key, value]) => !HIDDEN_DETAIL_KEYS.has(key) && ["string", "number", "boolean"].includes(typeof value))
    .map(([, value]) => value);
}

export function DataTable({
  columns,
  rows,
  empty = "Nothing to show yet",
  toolbar = true,
  details = true,
  dateRange = true,
  searchPlaceholder = "Search",
  searchClassName,
}: {
  columns: Array<{ key: string; label: string; render?: (row: Record<string, any>) => ReactNode }>;
  rows: Record<string, any>[];
  empty?: string;
  toolbar?: boolean;
  details?: boolean;
  dateRange?: boolean;
  searchPlaceholder?: string;
  searchClassName?: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const statusOptions = uniqueFilterOptions(rows.map((row) => row.status || row.metaStatus));
  const filtered = rows.filter((row) =>
    matchesSearch(search, rowSearchValues(row))
    && matchesDateRange(rowDate(row), from, to)
    && matchesSelected(statuses, String(row.status || row.metaStatus || ""))
  );
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const shownColumns = details
    ? [...columns.filter((column) => column.key !== "details"), { key: "details", label: "", render: (row: Record<string, any>) => <Button size="sm" variant="outline" onClick={() => setDetail(row)}>Details</Button> }]
    : columns;

  useEffect(() => {
    setPage(1);
  }, [search, from, to, statuses.join("|"), rows.length]);

  return (
    <div className="space-y-3">
      {toolbar ? (
        <TableFilters
          search={search}
          onSearchChange={setSearch}
          placeholder={searchPlaceholder}
          searchClassName={searchClassName}
          dateFrom={dateRange ? from : undefined}
          dateTo={dateRange ? to : undefined}
          onDateFromChange={dateRange ? setFrom : undefined}
          onDateToChange={dateRange ? setTo : undefined}
          active={Boolean(search || from || to || statuses.length)}
          onReset={() => { setSearch(""); setFrom(""); setTo(""); setStatuses([]); }}
        >
          {statusOptions.length ? (
            <FacetFilter
              title="Status"
              options={statusOptions}
              selected={statuses}
              onToggle={(value) => setStatuses((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])}
              onClear={() => setStatuses([])}
            />
          ) : null}
        </TableFilters>
      ) : null}
      {!filtered.length ? <EmptyState label={rows.length ? "No rows match these filters" : empty} /> : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {shownColumns.map((column, index) => (
                  <TableHead key={`${column.key}-${index}`}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row, index) => (
                <TableRow key={`${String(row.id || row._id || "row")}-${(safePage - 1) * pageSize + index}`}>
                  {shownColumns.map((column, columnIndex) => (
                    <TableCell key={`${column.key}-${columnIndex}`}>{column.render ? column.render(row) : cellText(row[column.key])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
      <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Details</DialogTitle></DialogHeader>
          {detail ? (
            <div className="space-y-2 text-sm">
              {detail.status || detail.metaStatus ? <StatusBadge value={String(detail.status || detail.metaStatus)} /> : null}
              {Object.entries(detail).filter(([key, value]) => !HIDDEN_DETAIL_KEYS.has(key) && ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[140px_1fr] gap-3 border-b py-2">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="break-words">{String(value)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader());
    } catch (loadError: any) {
      setError(loadError?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
