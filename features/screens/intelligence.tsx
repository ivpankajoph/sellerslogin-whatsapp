"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { asList, rowId, wa } from "@/lib/wa";
import { DataTable, Field, LoadingBlock, PageHeading, RefreshButton, StatusBadge, useResource } from "@/features/shared";

export function AgentsScreen() {
  const resource = useResource(() => wa("/agents"), []);
  const rows = asList(resource.data);
  const remove = async (id: string) => {
    await wa(`/agents/${id}`, { method: "DELETE" });
    resource.reload();
  };
  const toggle = async (agent: any, isActive: boolean) => {
    await wa(`/agents/${rowId(agent)}`, { method: "PUT", body: JSON.stringify({ ...agent, isActive }) });
    resource.reload();
  };
  return (
    <div className="space-y-4">
      <PageHeading title="AI agents" description="Agents that can reply inside WhatsApp conversations." actions={<RefreshButton onClick={resource.reload} pending={resource.loading} />} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable rows={rows} empty="No agents yet" columns={[
          { key: "name", label: "Name" },
          { key: "model", label: "Model" },
          { key: "isActive", label: "Active", render: (row) => <Switch checked={row.isActive !== false} onCheckedChange={(checked) => toggle(row, Boolean(checked))} /> },
          { key: "actions", label: "", render: (row) => <Button size="sm" variant="ghost" onClick={() => remove(rowId(row))}>Delete</Button> },
        ]} />
      )}
    </div>
  );
}

export function NewAgentScreen() {
  const [form, setForm] = useState({ name: "", description: "", systemPrompt: "", model: "gemini-2.5-flash", temperature: 0.4 });
  const [test, setTest] = useState("");
  const [reply, setReply] = useState("");
  const [agentId, setAgentId] = useState("");
  const create = async () => {
    try {
      const agent = await wa("/agents", { method: "POST", body: JSON.stringify({ ...form, temperature: Number(form.temperature), isActive: true }) });
      setAgentId(agent.id || agent._id);
      toast.success("Agent created");
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  const runTest = async () => {
    try {
      const result = await wa(`/agents/${agentId}/test`, { method: "POST", body: JSON.stringify({ message: test }) });
      setReply(result.reply || result.message || result.content || JSON.stringify(result));
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeading title="New AI agent" />
      <Card>
        <CardContent className="grid gap-3 pt-6">
          <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Description"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <Field label="Model">
            <Select value={form.model} onValueChange={(model) => setForm({ ...form, model })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Instructions"><Textarea value={form.systemPrompt} onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })} className="min-h-32" /></Field>
          <Button onClick={create}>Create agent</Button>
        </CardContent>
      </Card>
      {agentId ? (
        <Card>
          <CardHeader><CardTitle>Test this agent</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={test} onChange={(event) => setTest(event.target.value)} placeholder="Ask something a customer might ask" />
            <Button variant="outline" onClick={runTest}>Run test</Button>
            {reply ? <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{reply}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function PrefilledScreen() {
  const resource = useResource(async () => {
    const [mappings, agents] = await Promise.all([wa("/prefilled-text"), wa("/agents")]);
    return { mappings: asList(mappings), agents: asList(agents) };
  }, []);
  const [text, setText] = useState("");
  const [agentId, setAgentId] = useState("");
  const create = async () => {
    const agent = (resource.data?.agents || []).find((item) => rowId(item) === agentId);
    try {
      await wa("/prefilled-text", { method: "POST", body: JSON.stringify({ prefilledText: text, agentId, agentName: agent?.name || "" }) });
      toast.success("Mapping saved");
      setText("");
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeading title="Pre-filled text" description="Route a saved customer phrase to an AI agent." />
      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Phrase" />
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger><SelectValue placeholder="Agent" /></SelectTrigger>
          <SelectContent>{(resource.data?.agents || []).map((agent) => <SelectItem key={rowId(agent)} value={rowId(agent)}>{agent.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={create}>Add</Button>
      </div>
      {resource.loading ? <LoadingBlock /> : (
        <DataTable rows={resource.data?.mappings || []} empty="No mappings" columns={[
          { key: "prefilledText", label: "Phrase" },
          { key: "agentName", label: "Agent" },
          { key: "actions", label: "", render: (row) => <Button size="sm" variant="ghost" onClick={async () => { await wa(`/prefilled-text/${rowId(row)}`, { method: "DELETE" }); resource.reload(); }}>Delete</Button> },
        ]} />
      )}
    </div>
  );
}

export function MapAgentScreen() {
  const resource = useResource(async () => {
    const [mappings, agents, forms] = await Promise.all([wa("/map-agent"), wa("/agents"), wa("/facebook/forms").catch(() => [])]);
    return { mappings: asList(mappings), agents: asList(agents), forms: asList(forms) };
  }, []);
  const [formId, setFormId] = useState("");
  const [agentId, setAgentId] = useState("");
  const save = async () => {
    const form = (resource.data?.forms || []).find((item) => rowId(item) === formId || item.form_id === formId);
    const agent = (resource.data?.agents || []).find((item) => rowId(item) === agentId);
    try {
      await wa("/map-agent", { method: "POST", body: JSON.stringify({ formId, formName: form?.name || form?.form_name || "Form", agentId, agentName: agent?.name || "Agent", isActive: true }) });
      toast.success("Form mapped to agent");
      resource.reload();
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeading title="Map agent" description="Attach an AI agent to a Facebook lead form." />
      <div className="flex flex-wrap gap-2">
        <Select value={formId} onValueChange={setFormId}><SelectTrigger className="w-64"><SelectValue placeholder="Form" /></SelectTrigger><SelectContent>{(resource.data?.forms || []).map((form) => <SelectItem key={String(form.id || form.form_id)} value={String(form.id || form.form_id)}>{form.name || form.form_name}</SelectItem>)}</SelectContent></Select>
        <Select value={agentId} onValueChange={setAgentId}><SelectTrigger className="w-64"><SelectValue placeholder="Agent" /></SelectTrigger><SelectContent>{(resource.data?.agents || []).map((agent) => <SelectItem key={rowId(agent)} value={rowId(agent)}>{agent.name}</SelectItem>)}</SelectContent></Select>
        <Button onClick={save}>Save mapping</Button>
      </div>
      {resource.loading ? <LoadingBlock /> : <DataTable rows={resource.data?.mappings || []} empty="No mappings" columns={[{ key: "formName", label: "Form" }, { key: "agentName", label: "Agent" }, { key: "actions", label: "", render: (row) => <Button size="sm" variant="ghost" onClick={async () => { await wa(`/map-agent/${rowId(row)}`, { method: "DELETE" }); resource.reload(); }}>Delete</Button> }]} />}
    </div>
  );
}

export function AgentReportsScreen() {
  const resource = useResource(() => wa("/ai-analytics/qualifications").catch(() => wa("/ai-analytics")), []);
  const rows = asList(resource.data);
  return (
    <div className="space-y-4">
      <PageHeading title="Agent reports" actions={<RefreshButton onClick={resource.reload} pending={resource.loading} />} />
      {resource.loading ? <LoadingBlock /> : <DataTable rows={rows} empty="No agent analytics yet" columns={[{ key: "agentName", label: "Agent", render: (row) => row.agentName || row.name || "—" }, { key: "category", label: "Category", render: (row) => row.category || "—" }, { key: "count", label: "Count", render: (row) => row.count ?? row.total ?? "—" }]} />}
    </div>
  );
}

export function FacebookScreen({ kind }: { kind: "forms" | "leads" }) {
  const resource = useResource(() => wa(kind === "forms" ? "/facebook/forms" : "/facebook/leads"), [kind]);
  const rows = asList(resource.data);
  return (
    <div className="space-y-4">
      <PageHeading title={kind === "forms" ? "Facebook lead forms" : "Facebook leads"} actions={kind === "leads" ? <Button variant="outline" onClick={async () => { await wa("/leads/auto-reply/process-all", { method: "POST" }); toast.success("Auto replies queued"); }}>Process auto replies</Button> : <RefreshButton onClick={resource.reload} pending={resource.loading} />} />
      {resource.loading ? <LoadingBlock /> : (
        <DataTable
          rows={rows}
          empty={kind === "forms" ? "No forms connected" : "No leads yet"}
          columns={kind === "forms"
            ? [{ key: "name", label: "Form", render: (row) => row.name || row.form_name }, { key: "status", label: "Status", render: (row) => <StatusBadge value={String(row.status || "—")} /> }]
            : [
              { key: "name", label: "Name", render: (row) => row.name || row.full_name || "—" },
              { key: "phone", label: "Phone", render: (row) => row.phone || row.phone_number || "—" },
              { key: "actions", label: "", render: (row) => <Button size="sm" variant="outline" onClick={async () => { await wa(`/leads/auto-reply/send/${rowId(row)}`, { method: "POST" }); toast.success("Reply sent"); }}>Send reply</Button> },
            ]}
        />
      )}
    </div>
  );
}
