"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableFilters, matchesSearch } from "@/components/table-filters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { asList, rowId, wa } from "@/lib/wa";
import { DataTable, ErrorNote, Field, LoadingBlock, PageHeading, RefreshButton, StatGrid, StatusBadge, useResource } from "@/features/shared";

export function AutomationHome() {
  const resource = useResource(async () => {
    const [flows, drips, interest] = await Promise.all([
      wa("/automation/flows/stats").catch(() => ({})),
      wa("/drip-campaigns").catch(() => []),
      wa("/automation/interest/report?days=7").catch(() => ({})),
    ]);
    return { flows, drips: asList(drips), interest };
  }, []);
  return (
    <div className="space-y-4">
      <PageHeading title="Automation" description="Facebook lead replies, drip sequences, interest lists, and message flows." actions={<RefreshButton onClick={resource.reload} pending={resource.loading} />} />
      {resource.loading ? <LoadingBlock /> : (
        <StatGrid items={[
          { label: "Flows", value: resource.data?.flows?.total ?? resource.data?.flows?.count ?? "—" },
          { label: "Drip campaigns", value: resource.data?.drips.length || 0 },
          { label: "Interest contacts", value: resource.data?.interest?.total ?? resource.data?.interest?.count ?? "—" },
          { label: "Published flows", value: resource.data?.flows?.published ?? "—" },
        ]} />
      )}
    </div>
  );
}

export function TriggersScreen() {
  const resource = useResource(async () => {
    const [forms, templates, status] = await Promise.all([
      wa("/forms").catch(() => []),
      wa("/templates").catch(() => []),
      wa("/status").catch(() => ({})),
    ]);
    return { forms: asList(forms?.forms || forms), templates: asList(templates), running: Boolean(status?.is_running) };
  }, []);
  const [open, setOpen] = useState(false);
  const [formId, setFormId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const mapTemplate = async () => {
    const form = (resource.data?.forms || []).find((item) => String(item.form_id || item.id) === formId);
    const template = (resource.data?.templates || []).find((item) => rowId(item) === templateId);
    if (!form || !template) return;
    try {
      await wa("/set-trigger", {
        method: "POST",
        body: JSON.stringify({
          form_id: form.form_id || form.id,
          form_name: form.form_name || form.name,
          template_id: rowId(template),
          template_name: template.name,
        }),
      });
      toast.success("Template mapped to the form");
      setOpen(false);
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const setRunning = async (run: boolean) => {
    try {
      await wa("/control", { method: "POST", body: JSON.stringify({ run }) });
      toast.success(run ? "Automation started" : "Automation paused");
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading title="Facebook lead automation" description="Lead forms and the template each one sends." actions={<><Button variant="outline" onClick={() => setRunning(!resource.data?.running)}>{resource.data?.running ? "Pause" : "Start"}</Button><Button onClick={() => setOpen(true)}>Map template</Button></>} />
      {resource.error ? <ErrorNote message={resource.error} /> : null}
      {resource.loading ? <LoadingBlock /> : (
        <DataTable
          rows={resource.data?.forms || []}
          empty="No Facebook forms found"
          columns={[
            { key: "name", label: "Form", render: (row) => row.form_name || row.name },
            { key: "template", label: "Template", render: (row) => row.template_name || "—" },
            { key: "active", label: "Active", render: (row) => (
              <Switch checked={Boolean(row.is_active ?? row.automation_active)} onCheckedChange={async (checked) => {
                await wa("/toggle-form-automation", { method: "POST", body: JSON.stringify({ form_id: row.form_id || row.id, is_active: checked }) });
                resource.reload();
              }} />
            ) },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Map template</DialogTitle></DialogHeader>
          <Field label="Lead form">
            <Select value={formId} onValueChange={setFormId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a form" /></SelectTrigger>
              <SelectContent>
                {(resource.data?.forms || []).map((form) => (
                  <SelectItem key={String(form.form_id || form.id)} value={String(form.form_id || form.id)}>{form.form_name || form.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Template">
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a template" /></SelectTrigger>
              <SelectContent>
                {(resource.data?.templates || []).map((template) => (
                  <SelectItem key={rowId(template)} value={rowId(template)}>{template.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={mapTemplate}>Save mapping</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DripScreen() {
  const resource = useResource(async () => {
    const [campaigns, templates] = await Promise.all([wa("/drip-campaigns"), wa("/templates?metaOnly=true").catch(() => [])]);
    return { campaigns: asList(campaigns), templates: asList(templates) };
  }, []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phones, setPhones] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [delay, setDelay] = useState("1");

  const create = async () => {
    try {
      await wa("/drip-campaigns", {
        method: "POST",
        body: JSON.stringify({
          name,
          status: "draft",
          contacts: phones.split(/[\s,]+/).map((phone) => phone.trim()).filter(Boolean),
          steps: [{ templateName, scheduleType: "delay", delayHours: Number(delay) || 1 }],
        }),
      });
      toast.success("Drip campaign created");
      setName("");
      setPhones("");
      setOpen(false);
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading title="Drip campaigns" description="Sequence approved templates to a phone list." actions={<Button onClick={() => setOpen(true)}>New sequence</Button>} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable
          rows={resource.data?.campaigns || []}
          empty="No drip campaigns"
          columns={[
            { key: "name", label: "Name" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={String(row.status || "draft")} /> },
            { key: "contacts", label: "Contacts", render: (row) => (row.contacts || []).length },
            { key: "actions", label: "", render: (row) => (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={async () => { await wa(`/drip-campaigns/${rowId(row)}/toggle`, { method: "POST" }); resource.reload(); }}>Toggle</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await wa(`/drip-campaigns/${rowId(row)}`, { method: "DELETE" }); resource.reload(); }}>Delete</Button>
              </div>
            ) },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New sequence</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="First delay (hours)"><Input value={delay} onChange={(event) => setDelay(event.target.value)} /></Field>
            <Field label="Template">
              <Select value={templateName} onValueChange={setTemplateName}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Template" /></SelectTrigger>
                <SelectContent>{(resource.data?.templates || []).filter((template) => template.name).map((template) => <SelectItem key={rowId(template) || template.name} value={template.name}>{template.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Phone numbers"><Textarea value={phones} onChange={(event) => setPhones(event.target.value)} placeholder="One number per line" /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function InterestScreen() {
  const resource = useResource(() => wa("/automation/interest/report?days=30"), []);
  const rows = asList(resource.data?.contacts || resource.data?.rows || resource.data);
  return (
    <div className="space-y-4">
      <PageHeading title="Interest lists" description="Contacts grouped by the interests captured in conversations." actions={<RefreshButton onClick={resource.reload} pending={resource.loading} />} />
      {resource.loading ? <LoadingBlock /> : <DataTable rows={rows} empty="No interest records" columns={[{ key: "name", label: "Name", render: (row) => row.name || row.contactName || "—" }, { key: "phone", label: "Phone", render: (row) => row.phone || row.contactPhone || "—" }, { key: "interest", label: "Interest", render: (row) => row.interest || row.tag || row.label || "—" }]} />}
    </div>
  );
}

export function FlowListScreen() {
  const resource = useResource(() => wa("/automation/flows"), []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const rows = asList(resource.data);
  const create = async () => {
    if (!name.trim()) return toast.error("Enter a flow name");
    try {
      await wa("/automation/flows", { method: "POST", body: JSON.stringify({ name, status: "draft", nodes: [], edges: [] }) });
      toast.success("Flow created");
      setName("");
      setOpen(false);
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeading title="Automation flows" actions={<Button onClick={() => setOpen(true)}>Create flow</Button>} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable rows={rows} empty="No flows" columns={[
          { key: "name", label: "Name" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={String(row.status || "draft")} /> },
          { key: "actions", label: "", render: (row) => (
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => { await wa(`/automation/flows/${rowId(row)}/publish`, { method: "POST" }); resource.reload(); }}>Publish</Button>
              <Button size="sm" variant="outline" onClick={async () => { await wa(`/automation/flows/${rowId(row)}/duplicate`, { method: "POST" }); resource.reload(); }}>Duplicate</Button>
              <Button size="sm" variant="ghost" onClick={async () => { await wa(`/automation/flows/${rowId(row)}`, { method: "DELETE" }); resource.reload(); }}>Delete</Button>
            </div>
          ) },
        ]}         />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create flow</DialogTitle></DialogHeader>
          <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SegmentsScreen() {
  const resource = useResource(() => wa("/automation/segments"), []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const rows = asList(resource.data);
  const create = async () => {
    if (!name.trim()) return toast.error("Enter a segment name");
    await wa("/automation/segments", { method: "POST", body: JSON.stringify({ name, rules: [] }) });
    setName("");
    setOpen(false);
    resource.reload();
  };
  return (
    <div className="space-y-4">
      <PageHeading title="Segments" actions={<Button onClick={() => setOpen(true)}>New segment</Button>} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable rows={rows} empty="No segments" columns={[
          { key: "name", label: "Name" },
          { key: "count", label: "Contacts", render: (row) => row.count ?? row.contactCount ?? "—" },
          { key: "actions", label: "", render: (row) => <Button size="sm" variant="outline" onClick={async () => { await wa(`/automation/segments/${rowId(row)}/refresh`, { method: "POST" }); toast.success("Segment refreshed"); }}>Refresh</Button> },
        ]} />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New segment</DialogTitle></DialogHeader>
          <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function simpleFlow(heading: string, options: string[]) {
  const done = options.map((title, index) => ({
    id: `DONE_${index}`,
    title: title.slice(0, 30),
    terminal: true,
    success: true,
    data: {},
    layout: { type: "SingleColumnLayout", children: [{ type: "Form", name: "form", children: [{ type: "TextHeading", text: title.slice(0, 80) }, { type: "Footer", label: "Done", "on-click-action": { name: "complete", payload: { choice: title } } }] }] },
  }));
  return {
    version: "7.3",
    data_api_version: "3.0",
    routing_model: { MENU: options.map((_, index) => `DONE_${index}`), ...Object.fromEntries(options.map((_, index) => [`DONE_${index}`, []])) },
    screens: [...done, { id: "MENU", title: heading.slice(0, 30), terminal: false, data: {}, layout: { type: "SingleColumnLayout", children: [{ type: "NavigationList", name: "navigation_start", label: heading.slice(0, 80), "list-items": options.map((title, index) => ({ id: `opt_${index}`, "main-content": { title: title.slice(0, 30), description: "" }, "on-click-action": { name: "navigate", next: { type: "screen", name: `DONE_${index}` } } })) }] } }],
  };
}

export function MetaFlowsScreen() {
  const resource = useResource(() => wa("/webhook/whatsapp/flows"), []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [heading, setHeading] = useState("How can we help?");
  const [options, setOptions] = useState("Sales\nSupport");
  const [query, setQuery] = useState("");
  const [testFlow, setTestFlow] = useState<Record<string, any> | null>(null);
  const [phone, setPhone] = useState("");
  const rows = asList(resource.data?.flows || resource.data);

  const create = async () => {
    const choices = options.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!name.trim() || choices.length < 2) {
      toast.error("Enter a flow name and at least two options");
      return;
    }
    setSaving(true);
    try {
      const flowJson = simpleFlow(heading, choices);
      await wa("/webhook/whatsapp/flows/validate-json", { method: "POST", body: JSON.stringify({ flowJson }) });
      await wa("/webhook/whatsapp/flows/create", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), categories: ["OTHER"], flowJson }),
      });
      toast.success("Flow created");
      setOpen(false);
      setName("");
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testFlow || !phone.trim()) return;
    try {
      await wa(`/webhook/whatsapp/flows/${rowId(testFlow)}/send-test`, { method: "POST", body: JSON.stringify({ phone: phone.trim() }) });
      toast.success("Test sent");
      setTestFlow(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="WhatsApp flows"
        description="Flows saved for this WhatsApp account."
        actions={
          <>
            <Button variant="outline" onClick={async () => { await wa("/webhook/whatsapp/flows/sync", { method: "POST" }); toast.success("Synced from Meta"); resource.reload(); }}>Sync Meta</Button>
            <Button onClick={() => setOpen(true)}>Create flow</Button>
          </>
        }
      />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable
          rows={rows}
          empty="No flows yet"
          columns={[
            { key: "name", label: "Name" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={String(row.status || "draft")} /> },
            { key: "categories", label: "Category", render: (row) => (Array.isArray(row.categories) ? row.categories.join(", ") : row.categories || "—") },
            { key: "updatedAt", label: "Updated", render: (row) => row.updatedAt || row.createdAt ? new Date(row.updatedAt || row.createdAt).toLocaleString() : "—" },
            { key: "actions", label: "", render: (row) => (
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" onClick={async () => { await wa(`/webhook/whatsapp/flows/${rowId(row)}/publish-meta`, { method: "POST" }); toast.success("Publish requested"); resource.reload(); }}>Publish</Button>
                <Button size="sm" variant="outline" onClick={() => setTestFlow(row)}>Send test</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await wa(`/webhook/whatsapp/flows/${rowId(row)}`, { method: "DELETE" }); toast.success("Flow deleted"); resource.reload(); }}>Delete</Button>
              </div>
            ) },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create flow</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Flow name"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="sellers_login_flow" /></Field>
            <Field label="Question"><Input value={heading} onChange={(event) => setHeading(event.target.value)} /></Field>
            <Field label="Options, one per line"><Textarea value={options} onChange={(event) => setOptions(event.target.value)} className="min-h-28" /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Creating..." : "Create flow"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(testFlow)} onOpenChange={(next) => { if (!next) setTestFlow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send test</DialogTitle>
          </DialogHeader>
          <Field label="WhatsApp number"><Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="9198XXXXXXXX" /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestFlow(null)}>Cancel</Button>
            <Button onClick={sendTest}>Send test</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
