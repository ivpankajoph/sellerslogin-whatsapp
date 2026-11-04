"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { wa } from "@/lib/wa";
import { ErrorNote, Field, LoadingBlock, PageHeading, RefreshButton, StatGrid, useResource } from "@/features/shared";

export function DashboardScreen() {
  const [period, setPeriod] = useState("month");
  const resource = useResource(() => wa(`/reports/enhanced-dashboard?period=${period}`), [period]);
  const summary = resource.data?.summary || {};
  const changes = resource.data?.changes || {};
  const days = Array.isArray(resource.data?.dayWise) ? resource.data.dayWise : [];
  const max = Math.max(1, ...days.map((day: any) => Number(day.sent || 0)));

  return (
    <div className="space-y-6">
      <PageHeading
        title="WhatsApp dashboard"
        description="Delivery, reads, conversations, and new contacts for this workspace."
        actions={
          <>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
            <RefreshButton onClick={resource.reload} pending={resource.loading} />
          </>
        }
      />
      {resource.error ? <ErrorNote message={resource.error} /> : null}
      {resource.loading && !resource.data ? <LoadingBlock label="Loading dashboard" /> : null}
      <StatGrid
        items={[
          { label: "Messages", value: summary.totalMessages ?? 0, hint: `${changes.messagesChange ?? 0}% vs previous` },
          { label: "Delivered", value: summary.delivered ?? 0, hint: `${summary.deliveryRate ?? 0}% delivery rate` },
          { label: "Read rate", value: `${summary.readRate ?? 0}%`, hint: `${summary.read ?? 0} read` },
          { label: "Active contacts", value: summary.activeContacts ?? 0, hint: `${summary.newContacts ?? 0} new` },
        ]}
      />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Day by day</CardTitle>
            <CardDescription>Sent messages across the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-3 overflow-y-auto">
            {days.length === 0 ? <p className="text-sm text-muted-foreground">No message activity yet.</p> : null}
            {days.map((day: any, index: number) => (
              <div key={`${day.day}-${index}`} className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_36px] items-center gap-3">
                <span className="truncate text-muted-foreground">{day.day}</span>
                <Progress value={(Number(day.sent || 0) / max) * 100} />
                <span className="text-right tabular-nums">{day.sent || 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Conversation mix</CardTitle>
            <CardDescription>How replies were handled inside the 24-hour window.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              ["Outbound", summary.outboundMessages],
              ["Inbound", summary.inboundMessages],
              ["AI replies", summary.totalAiResponses],
              ["Human replies", summary.totalHumanResponses],
              ["Window compliant", summary.windowCompliant],
              ["AI share", `${summary.aiPercentage ?? 0}%`],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border px-3 py-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold">{value ?? 0}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function useAccountStatus() {
  return useResource(async () => {
    const [credentials, integrations] = await Promise.all([
      wa("/credentials").catch(() => null),
      wa("/integrations/connections/status").catch(() => []),
    ]);
    const saved = Boolean(credentials?.status?.hasWhatsApp || credentials?.status?.isVerified);
    const list = Array.isArray(integrations) ? integrations : [];
    const whatsapp = list.find((item: any) => item?.provider?.id === "whatsapp");
    const connected = saved || Boolean(whatsapp?.isConnected && whatsapp?.connection?.status === "connected");
    return { connected, credentials, whatsapp };
  }, []);
}

export function SetupScreen({ onConnected }: { onConnected: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({ accessToken: "", phoneNumberId: "", businessAccountId: "", webhookVerifyToken: "" });
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Test message from my connected WhatsApp number.");

  const connect = async () => {
    if (!form.accessToken.trim() || !form.phoneNumberId.trim() || !form.businessAccountId.trim()) {
      toast.error("Access token, phone number ID, and business account ID are required");
      return;
    }
    setSaving(true);
    try {
      await wa("/integrations/connect", {
        method: "POST",
        body: JSON.stringify({
          providerId: "whatsapp",
          setAsDefault: true,
          credentials: {
            accessToken: form.accessToken.trim(),
            phoneNumberId: form.phoneNumberId.trim(),
            businessAccountId: form.businessAccountId.trim(),
            webhookVerifyToken: form.webhookVerifyToken.trim(),
          },
        }),
      });
      toast.success("WhatsApp API connected");
      setOpen(false);
      onConnected();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await wa("/webhook/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({ to: testPhone.trim(), message: testMessage.trim() }),
      });
      toast.success("Test message sent");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <Badge variant="outline" className="w-fit">Not connected</Badge>
          <CardTitle>Connect your WhatsApp Business number</CardTitle>
          <CardDescription>Use the Meta access token, phone number ID, and WhatsApp business account ID for this seller.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {["Create a Meta app", "Generate a system token", "Save the API credentials"].map((step, index) => (
              <div key={step} className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">{index + 1}</div>
                {step}
              </div>
            ))}
          </div>
          <Button onClick={() => setOpen(true)}>Connect through Meta APIs</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Send a test</CardTitle>
          <CardDescription>Available after the number is connected.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Recipient number"><Input value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="9198XXXXXXXX" /></Field>
          <Field label="Message"><Textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} /></Field>
          <Button variant="outline" onClick={sendTest} disabled={testing}>Send test message</Button>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WhatsApp API credentials</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Access token"><Textarea value={form.accessToken} onChange={(event) => setForm({ ...form, accessToken: event.target.value })} /></Field>
            <Field label="Phone number ID"><Input value={form.phoneNumberId} onChange={(event) => setForm({ ...form, phoneNumberId: event.target.value })} /></Field>
            <Field label="Business account ID"><Input value={form.businessAccountId} onChange={(event) => setForm({ ...form, businessAccountId: event.target.value })} /></Field>
            <Field label="Webhook verify token"><Input value={form.webhookVerifyToken} onChange={(event) => setForm({ ...form, webhookVerifyToken: event.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={connect} disabled={saving}>{saving ? "Connecting..." : "Save connection"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
