"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asList, rowId, uniqueRows, wa, whatsappUser } from "@/lib/wa";
import { FacetFilter, matchesDateRange, matchesSearch, matchesSelected, rowDate, TableFilters, uniqueFilterOptions } from "@/components/table-filters";
import { DataTable, ErrorNote, Field, LoadingBlock, PageHeading, RefreshButton, StatusBadge, useResource } from "@/features/shared";
import { TemplateEditor, templateToDraft } from "@/features/screens/template-editor";

export function ContactsScreen() {
  const resource = useResource(async () => {
    const [regular, importedContacts] = await Promise.all([
      wa("/contacts").catch(() => []),
      wa("/broadcast/imported-contacts").catch(() => []),
    ]);
    const imported = asList(importedContacts).map((contact) => ({ ...contact, source: contact.source || "import" }));
    return uniqueRows([...asList(regular), ...imported]);
  }, []);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", tags: "", notes: "" });
  const rows = (resource.data || []).filter((contact: any) => {
    const tags = Array.isArray(contact.tags) ? contact.tags.join(" ") : "";
    return matchesSearch(query, [contact.name, contact.phone, contact.email, tags])
      && matchesDateRange(rowDate(contact), from, to)
      && matchesSelected(sources, String(contact.source || "manual"));
  });

  const create = async () => {
    try {
      await wa("/contacts", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          notes: form.notes,
          tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      toast.success("Contact created");
      setOpen(false);
      setForm({ name: "", phone: "", email: "", tags: "", notes: "" });
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const remove = async (id: string) => {
    try {
      await wa(`/contacts/${id}`, { method: "DELETE" });
      toast.success("Contact removed");
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Contacts"
        description="Saved contacts and imported broadcast audiences."
        actions={<><Button onClick={() => setOpen(true)}>Add contact</Button><RefreshButton onClick={resource.reload} pending={resource.loading} /></>}
      />
      {resource.error ? <ErrorNote message={resource.error} /> : null}
      {resource.loading ? <LoadingBlock /> : (
        <DataTable
          rows={rows}
          empty="No contacts yet"
          columns={[
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "email", label: "Email" },
            { key: "source", label: "Source", render: (row) => row.source || "manual" },
            { key: "tags", label: "Tags", render: (row) => (Array.isArray(row.tags) ? row.tags.join(", ") : "—") },
            { key: "actions", label: "", render: (row) => <Button size="sm" variant="ghost" onClick={() => remove(rowId(row))}>Delete</Button> },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New contact</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <Field label="Email"><Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label="Tags"><Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="vip, lead" /></Field>
            <Field label="Notes"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          </div>
          <DialogFooter><Button onClick={create}>Save contact</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TemplatesScreen({ view }: { view: "list" | "add" | "manage" | "status" }) {
  const resource = useResource(() => (view === "status" ? wa("/meta-templates") : wa("/templates")), [view]);
  const rows = asList(resource.data?.templates || resource.data);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);

  const sync = async () => {
    try {
      await wa("/templates/sync-meta", { method: "POST" });
      toast.success("Synced with Meta");
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const removeSelected = async () => {
    try {
      await wa("/templates/bulk-delete", { method: "POST", body: JSON.stringify({ ids: selected }) });
      toast.success("Templates deleted");
      setSelected([]);
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title={view === "add" ? "Add template" : view === "status" ? "Meta template status" : "Templates"}
        description="Create, review, and submit WhatsApp message templates."
        actions={view === "add" ? null : <><Button variant="outline" onClick={sync}>Sync Meta</Button>{selected.length ? <Button variant="destructive" onClick={removeSelected}>Delete selected</Button> : null}<RefreshButton onClick={resource.reload} pending={resource.loading} /></>}
      />
      {view === "add" ? <TemplateEditor /> : resource.loading ? <LoadingBlock /> : (
        <>
        <DataTable
          rows={rows}
          searchPlaceholder="Search templates"
          empty="No templates yet"
          columns={[
            { key: "pick", label: "", render: (row) => <Checkbox checked={selected.includes(rowId(row))} onCheckedChange={(checked) => setSelected((current) => checked ? [...current, rowId(row)] : current.filter((id) => id !== rowId(row)))} /> },
            { key: "name", label: "Name" },
            { key: "category", label: "Category", render: (row) => row.category || row.type || "—" },
            { key: "language", label: "Language", render: (row) => row.language || "—" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={String(row.status || row.metaStatus || "draft")} /> },
            { key: "actions", label: "", render: (row) => <Button size="sm" variant="outline" onClick={() => setEditing(row)}>Edit</Button> },
          ]}
        />
        </>
      )}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader><DialogTitle>Edit template</DialogTitle></DialogHeader>
          {editing ? <TemplateEditor initial={templateToDraft(editing)} onDone={() => { setEditing(null); resource.reload(); }} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function whenLabel(row: Record<string, any>) {
  const value = row.scheduledTime || row.scheduledAt || row.scheduleTime || row.nextRunAt || row.timestamp || row.createdAt;
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function campaignRows(logs: Record<string, any>[]) {
  const grouped = new Map<string, Record<string, any>>();
  for (const log of logs) {
    const name = String(log.campaignName || "Untitled");
    const current = grouped.get(name) || { id: name, name, contacts: 0, status: log.status || "sent", when: log.timestamp || log.createdAt || log.sentAt };
    current.contacts += 1;
    if (log.status === "failed") current.status = "failed";
    grouped.set(name, current);
  }
  return [...grouped.values()];
}

export function BroadcastScreen() {
  const resource = useResource(async () => {
    const [contacts, imported, templates, logs] = await Promise.all([
      wa("/contacts").catch(() => []),
      wa("/broadcast/imported-contacts").catch(() => []),
      wa("/templates").catch(() => []),
      wa("/broadcast/logs?limit=500").catch(() => []),
    ]);
    return { contacts: uniqueRows([...asList(contacts), ...asList(imported)]), templates: uniqueRows(asList(templates)), logs: asList(logs) };
  }, []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [messageType, setMessageType] = useState("template");
  const [templateName, setTemplateName] = useState("");
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [scheduled, setScheduled] = useState("");
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const contacts = resource.data?.contacts || [];
  const rows = campaignRows((resource.data?.logs || []).filter((log) => log.campaignName !== "Single Message")).filter((row) => matchesSearch(query, [row.name, row.status]));

  const send = async () => {
    const targets = contacts.filter((contact) => picked.includes(rowId(contact)));
    if (!name.trim() || !targets.length) {
      toast.error("Add a campaign name and at least one contact");
      return;
    }
    setSending(true);
    try {
      await wa("/broadcast/send", {
        method: "POST",
        body: JSON.stringify({
          contacts: targets,
          messageType,
          templateName: messageType === "template" ? templateName : undefined,
          customMessage: messageType === "custom" ? message : undefined,
          campaignName: name.trim(),
          isScheduled: Boolean(scheduled),
          scheduledTime: scheduled ? new Date(scheduled).toISOString() : undefined,
          senderId: whatsappUser()?.id,
        }),
      });
      toast.success(scheduled ? "Broadcast scheduled" : "Broadcast queued");
      setOpen(false);
      setName("");
      setPicked([]);
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading title="Broadcasts" description="Campaigns sent from this WhatsApp account." actions={<Button onClick={() => setOpen(true)}>New broadcast</Button>} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable rows={rows} searchPlaceholder="Search campaign" empty="No broadcasts yet" columns={[
          { key: "name", label: "Campaign" },
          { key: "contacts", label: "Contacts" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={String(row.status || "sent")} /> },
          { key: "when", label: "When", render: (row) => whenLabel(row) },
        ]} />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>New broadcast</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Campaign name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Schedule"><Input type="datetime-local" value={scheduled} onChange={(event) => setScheduled(event.target.value)} /></Field>
            <Field label="Message type">
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="custom">Custom text</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {messageType === "template" ? (
              <Field label="Template">
                <Select value={templateName} onValueChange={setTemplateName}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose template" /></SelectTrigger>
                  <SelectContent>
                    {(resource.data?.templates || []).filter((template) => template.name).map((template) => (
                      <SelectItem key={template.name} value={template.name}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : <Field label="Message"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} /></Field>}
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border">
            <DataTable rows={contacts} searchPlaceholder="Search contacts by name or phone" dateRange={false} details={false} searchClassName="h-10 w-full" empty="No contacts" columns={[
              { key: "pick", label: "", render: (row) => <Checkbox checked={picked.includes(rowId(row))} onCheckedChange={(checked) => setPicked((current) => checked ? [...current, rowId(row)] : current.filter((id) => id !== rowId(row)))} /> },
              { key: "name", label: "Name" },
              { key: "phone", label: "Phone" },
            ]} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={send} disabled={sending}>{sending ? "Sending..." : `Send to ${picked.length}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SingleMessageScreen() {
  const resource = useResource(async () => {
    const [logs, templates] = await Promise.all([
      wa(`/broadcast/logs?limit=500&campaignName=${encodeURIComponent("Single Message")}`).catch(() => []),
      wa("/templates").catch(() => []),
    ]);
    return { logs: asList(logs), templates: uniqueRows(asList(templates)) };
  }, []);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);
  const rows = resource.data?.logs || [];

  const send = async () => {
    if (!phone.trim() || !templateName) return toast.error("Enter a number and choose a template");
    setSending(true);
    try {
      await wa("/broadcast/send", {
        method: "POST",
        body: JSON.stringify({
          contacts: [{ name: phone.trim(), phone: phone.trim() }],
          messageType: "template",
          templateName,
          campaignName: "Single Message",
          senderId: whatsappUser()?.id,
        }),
      });
      toast.success("Message sent");
      setOpen(false);
      setPhone("");
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading title="Single messages" description="One-to-one template messages." actions={<Button onClick={() => setOpen(true)}>Send message</Button>} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable rows={rows} empty="No single messages yet" columns={[
          { key: "contactName", label: "Contact", render: (row) => row.contactName || "—" },
          { key: "contactPhone", label: "Phone" },
          { key: "templateName", label: "Template" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={String(row.status || "sent")} /> },
          { key: "when", label: "When", render: (row) => whenLabel(row) },
        ]} />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send message</DialogTitle></DialogHeader>
          <Field label="Phone number"><Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="9198XXXXXXXX" /></Field>
          <Field label="Template">
            <Select value={templateName} onValueChange={setTemplateName}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose template" /></SelectTrigger>
              <SelectContent>{(resource.data?.templates || []).filter((template) => template.name).map((template) => <SelectItem key={template.name} value={template.name}>{template.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={send} disabled={sending}>{sending ? "Sending..." : "Send"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ScheduleScreen() {
  const resource = useResource(() => wa("/broadcast/scheduled-broadcasts"), []);
  const rows = asList(resource.data);
  const cancel = async (id: string) => {
    try {
      await wa(`/broadcast/scheduled-broadcasts/${id}/cancel`, { method: "POST" });
      toast.success("Schedule cancelled");
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeading title="Scheduled messages" actions={<RefreshButton onClick={resource.reload} pending={resource.loading} />} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable
          rows={rows}
          empty="No scheduled broadcasts"
          columns={[
            { key: "campaignName", label: "Campaign", render: (row) => row.campaignName || row.name || "—" },
            { key: "scheduledTime", label: "When", render: (row) => whenLabel(row) },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={String(row.status || "scheduled")} /> },
            { key: "actions", label: "", render: (row) => <Button size="sm" variant="outline" onClick={() => cancel(rowId(row))}>Cancel</Button> },
          ]}
        />
      )}
    </div>
  );
}

export function CampaignManagerScreen() {
  const resource = useResource(async () => {
    const [campaigns, templates] = await Promise.all([
      wa("/broadcast/campaigns").catch(() => []),
      wa("/templates").catch(() => []),
    ]);
    return { campaigns: asList(campaigns), templates: asList(templates) };
  }, []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = async () => {
    if (!name.trim()) return toast.error("Enter a campaign name");
    try {
      await wa("/broadcast/campaigns", { method: "POST", body: JSON.stringify({ name, status: "draft" }) });
      toast.success("Campaign created");
      setName("");
      setOpen(false);
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  const run = async (id: string) => {
    try {
      await wa(`/broadcast/campaigns/${id}/execute`, { method: "POST" });
      toast.success("Campaign started");
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  const remove = async (id: string) => {
    try {
      await wa(`/broadcast/campaigns/${id}`, { method: "DELETE" });
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeading title="Campaign manager" description={`${resource.data?.templates.length || 0} templates available for campaign lists.`} actions={<Button onClick={() => setOpen(true)}>New campaign</Button>} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable
          rows={resource.data?.campaigns || []}
          empty="No campaigns"
          columns={[
            { key: "name", label: "Name" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={String(row.status || "draft")} /> },
            { key: "actions", label: "", render: (row) => (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => run(rowId(row))}>Run</Button>
                <Button size="sm" variant="outline" onClick={() => remove(rowId(row))}>Delete</Button>
              </div>
            ) },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
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

export function UsersScreen() {
  const resource = useResource(async () => {
    const [users, pages, roles] = await Promise.all([
      wa("/users"),
      wa("/users/pages").catch(() => []),
      wa("/users/roles").catch(() => []),
    ]);
    return { users: asList(users), pages: asList(pages), roles: asList(roles) };
  }, []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "user", pageAccess: ["dashboard"] as string[] });
  const pages = resource.data?.pages || [];
  const create = async () => {
    try {
      const created = await wa("/users", { method: "POST", body: JSON.stringify(form) });
      toast.success(created.emailSent ? "User created and emailed" : "User created");
      setOpen(false);
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  const toggle = (pageId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      pageAccess: checked ? [...current.pageAccess, pageId] : current.pageAccess.filter((id) => id !== pageId),
    }));
  };
  return (
    <div className="space-y-4">
      <PageHeading title="User management" description="Team members who can open parts of this WhatsApp workspace." actions={<Button onClick={() => setOpen(true)}>Add user</Button>} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable
          rows={resource.data?.users || []}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "isActive", label: "Active", render: (row) => (row.isActive === false ? "No" : "Yes") },
            { key: "actions", label: "", render: (row) => (
              <Button size="sm" variant="outline" onClick={async () => {
                await wa(`/users/${rowId(row)}`, { method: "DELETE" });
                resource.reload();
              }}>Remove</Button>
            ) },
          ]}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New team member</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Email"><Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label="Role">
              <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(resource.data?.roles.length ? resource.data.roles : [{ id: "user", name: "User" }, { id: "admin", name: "Admin" }]).map((role: any) => (
                    <SelectItem key={role.id || role.name} value={role.id || role.name}>{role.name || role.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid max-h-48 gap-2 overflow-auto">
              {pages.map((page) => (
                <label key={page.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.pageAccess.includes(page.id)} onCheckedChange={(checked) => toggle(page.id, Boolean(checked))} />
                  {page.name}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={create}>Create user</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SettingsScreen({ section }: { section: "account" | "profile" | "api" | "events" }) {
  const status = useResource(() => wa("/integrations/connections/status"), []);
  const profile = useResource(() => wa("/integrations/whatsapp/profile").catch(() => null), []);
  const credentials = useResource(() => wa("/credentials").catch(() => null), []);
  const events = useResource(() => wa("/webhook/whatsapp/status-events").catch(() => []), []);
  const connection = useMemo(() => asList(status.data).find((item) => item?.provider?.id === "whatsapp"), [status.data]);
  const [verify, setVerify] = useState("");

  const saveCredentials = async () => {
    try {
      await wa("/credentials", { method: "POST", body: JSON.stringify({ webhookVerifyToken: verify }) });
      toast.success("Credentials updated");
      credentials.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const delink = async () => {
    try {
      await wa("/integrations/whatsapp/delink", { method: "POST" });
      toast.success("WhatsApp number disconnected");
      status.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (section === "profile") {
    const details = profile.data || {};
    return (
      <div className="space-y-4">
        <PageHeading title="WhatsApp profile" actions={<Button variant="outline" onClick={delink}>Disconnect number</Button>} />
        {profile.loading ? <LoadingBlock /> : (
          <Card><CardContent className="grid gap-2 pt-6 text-sm">
            {Object.entries(details).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 border-b py-2"><span className="text-muted-foreground">{key}</span><span>{String(value)}</span></div>
            ))}
          </CardContent></Card>
        )}
      </div>
    );
  }

  if (section === "api") {
    return (
      <div className="space-y-4">
        <PageHeading title="Webhook and API" description="Verification token stored for this WhatsApp account." />
        <Card><CardContent className="grid gap-3 pt-6">
          <p className="text-sm text-muted-foreground">Current status: {credentials.data?.status?.isVerified ? "verified" : "not verified"}</p>
          <Field label="Webhook verify token"><Input value={verify} onChange={(event) => setVerify(event.target.value)} /></Field>
          <Button onClick={saveCredentials}>Save</Button>
        </CardContent></Card>
      </div>
    );
  }

  if (section === "events") {
    return (
      <div className="space-y-4">
        <PageHeading title="Webhook events" actions={<RefreshButton onClick={events.reload} pending={events.loading} />} />
        {events.loading ? <LoadingBlock /> : <DataTable rows={asList(events.data)} empty="No webhook events" columns={[{ key: "status", label: "Status" }, { key: "recipient", label: "Recipient", render: (row) => row.recipient || row.phone || "—" }, { key: "createdAt", label: "When", render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : "—" }]} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Account" description="Connection status for the signed-in seller." />
      <Card>
        <CardHeader><CardTitle>{connection?.isConnected ? "Connected" : "Not connected"}</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {connection?.connection?.displayName || connection?.connection?.phoneNumber || "Connect a WhatsApp Business number from the setup screen."}
        </CardContent>
      </Card>
    </div>
  );
}
