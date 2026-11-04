"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { asList, rowId, wa } from "@/lib/wa";
import { LoadingBlock } from "@/features/shared";

type Mode = "inbox" | "window" | "leads";

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function chatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function messageText(message: { content?: string; text?: string; type?: string }) {
  const raw = String(message.content || message.text || "").trim();
  if (!raw) return message.type === "image" ? "Photo" : message.type || "Message";
  return raw.replace(/^\[Template sent:\s*/i, "Template · ").replace(/\]$/, "");
}

function contactTitle(contact: { name?: string; phone?: string } | undefined) {
  const name = String(contact?.name || "").trim();
  const phone = String(contact?.phone || "").trim();
  if (!name || digits(name) === digits(phone)) return phone || "Unknown";
  return name;
}

const endpoints: Record<Mode, string> = {
  inbox: "/chats",
  window: "/chats/window",
  leads: "/chats/whatsapp-leads",
};

export function InboxScreen({ mode }: { mode: Mode }) {
  const [chats, setChats] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [assignees, setAssignees] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [assignee, setAssignee] = useState("");

  const loadChats = async () => {
    const data = await wa(endpoints[mode]);
    const list = asList(data);
    setChats(list);
    setSelectedId((current) => current || String(list[0]?.contactId || list[0]?.contact?.id || ""));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      wa(endpoints[mode]),
      wa("/templates").catch(() => []),
      wa("/agents").catch(() => []),
      mode === "inbox" ? wa("/lead-management/assignable-users").catch(() => []) : Promise.resolve([]),
    ])
      .then(([chatData, templateData, agentData, userData]) => {
        if (!active) return;
        const list = asList(chatData);
        setChats(list);
        setTemplates(asList(templateData));
        setAgents(asList(agentData));
        setAssignees(asList(userData));
        setSelectedId(String(list[0]?.contactId || list[0]?.contact?.id || ""));
      })
      .catch((error) => toast.error(error.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    const timer = window.setInterval(() => {
      loadChats().catch(() => undefined);
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [mode]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    wa(`/messages?contactId=${encodeURIComponent(selectedId)}`)
      .then((data) => setMessages(asList(data)))
      .catch(() => setMessages([]));
  }, [selectedId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return chats.filter((chat) => {
      const name = String(chat.contact?.name || chat.name || "").toLowerCase();
      const phone = String(chat.contact?.phone || chat.phone || "");
      return !needle || name.includes(needle) || phone.includes(needle);
    });
  }, [chats, query]);

  const selected = chats.find((chat) => String(chat.contactId || chat.contact?.id) === selectedId);
  const phone = String(selected?.contact?.phone || "").replace(/\D/g, "");
  const name = contactTitle(selected?.contact);

  const sendText = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      await wa("/webhook/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({ to: phone, message: draft.trim() }),
      });
      await wa("/messages", {
        method: "POST",
        body: JSON.stringify({
          contactId: selectedId,
          content: draft.trim(),
          type: "text",
          direction: "outbound",
          status: "sent",
        }),
      });
      setDraft("");
      const next = await wa(`/messages?contactId=${encodeURIComponent(selectedId)}`);
      setMessages(asList(next));
      toast.success("Message sent");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const sendTemplate = async () => {
    const template = templates.find((item) => rowId(item) === templateId);
    if (!template || !selected) return;
    setSending(true);
    try {
      await wa("/inbox/send", {
        method: "POST",
        body: JSON.stringify({
          contactId: selectedId,
          phone,
          name,
          messageType: "template",
          templateName: template.name,
        }),
      });
      setTemplateOpen(false);
      toast.success("Template sent");
      const next = await wa(`/messages?contactId=${encodeURIComponent(selectedId)}`);
      setMessages(asList(next));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const mark = async (read: boolean) => {
    try {
      await wa(`/chats/${selectedId}/${read ? "mark-read" : "mark-unread"}`, { method: "POST" });
      await loadChats();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const block = async () => {
    try {
      await wa("/contacts/block", { method: "POST", body: JSON.stringify({ contactId: selectedId }) });
      toast.success("Contact blocked");
      await loadChats();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const assign = async () => {
    const user = assignees.find((item) => rowId(item) === assignee);
    if (!user) return;
    try {
      await wa("/lead-management/assign", {
        method: "POST",
        body: JSON.stringify({
          contactId: selectedId,
          assignedToUserId: rowId(user),
          assignedToUserName: user.name,
        }),
      });
      toast.success("Lead assigned");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) return <LoadingBlock label="Loading conversations" />;

  return (
    <div className="wa-chat overflow-hidden rounded-xl border bg-white shadow-sm" style={{ height: "calc(100vh - 7.5rem)" }}>
      <div className="grid h-full min-h-0 lg:grid-cols-[380px_1fr]">
        <div className="flex min-h-0 flex-col border-r bg-white">
          <div className="border-b bg-[#f0f2f5] px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-[#111b21]">{mode === "window" ? "24-hour window" : "Chats"}</p>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search or start a new chat" className="h-9 rounded-lg border-0 bg-white" />
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {visible.length === 0 ? <p className="px-4 py-8 text-sm text-[#667781]">No conversations yet.</p> : null}
            {visible.map((chat, index) => {
              const id = String(chat.contactId || chat.contact?.id || index);
              const title = contactTitle(chat.contact);
              const active = id === selectedId;
              return (
                <button
                  key={`${id}-${index}`}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${active ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"}`}
                >
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-[#dfe5e7] text-sm text-[#54656f]">{title.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 border-b border-[#f0f2f5] py-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] text-[#111b21]">{title}</span>
                      <span className={`shrink-0 text-[11px] ${chat.unreadCount > 0 ? "text-[#25d366]" : "text-[#667781]"}`}>{chatTime(chat.lastMessageTime || chat.lastInboundMessageTime)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] text-[#667781]">{chat.lastMessage || "No messages"}</span>
                      {chat.unreadCount > 0 ? <Badge className="h-5 min-w-5 justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] text-white">{chat.unreadCount}</Badge> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </ScrollArea>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col bg-[#efeae2]">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b bg-[#f0f2f5] px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-10"><AvatarFallback className="bg-[#dfe5e7] text-[#54656f]">{name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-[#111b21]">{name}</p>
                    <p className="truncate text-xs text-[#667781]">{selected.contact?.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="text-[#54656f]" onClick={() => setTemplateOpen(true)}>Template</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-[#54656f]"><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => mark(true)}>Mark read</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => mark(false)}>Mark unread</DropdownMenuItem>
                      <DropdownMenuItem onClick={block}>Block contact</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {mode === "inbox" && assignees.length > 0 ? (
                <div className="flex gap-2 border-b bg-[#f0f2f5] px-4 py-2">
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger className="h-8 w-52 bg-white"><SelectValue placeholder="Assign" /></SelectTrigger>
                    <SelectContent>
                      {assignees.map((user) => (
                        <SelectItem key={rowId(user)} value={rowId(user)}>{user.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="secondary" onClick={assign}>Assign</Button>
                </div>
              ) : null}
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-1.5 px-[6%] py-4">
                  {messages.map((message, index) => {
                    const outbound = message.direction === "outbound";
                    return (
                      <div key={`${rowId(message) || message.timestamp || "message"}-${index}`} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-lg px-2.5 py-1.5 text-[14.5px] leading-5 text-[#111b21] shadow-sm ${outbound ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"}`}>
                          <p className="whitespace-pre-wrap">{messageText(message)}</p>
                          <p className="mt-0.5 text-right text-[11px] text-[#667781]">
                            {chatTime(message.timestamp)}
                            {outbound && message.status ? ` · ${message.status}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex items-end gap-2 bg-[#f0f2f5] px-3 py-2">
                <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a message" className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border-0 bg-white" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendText(); } }} />
                <Button size="icon" className="size-11 rounded-full bg-[#25d366] text-white hover:bg-[#1da851]" onClick={sendText} disabled={sending || !draft.trim()} aria-label="Send">
                  <Send />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-[#667781]">Select a conversation</div>
          )}
        </div>
      </div>
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send a template</DialogTitle></DialogHeader>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={rowId(template)} value={rowId(template)}>{template.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {agents.length ? <p className="text-xs text-muted-foreground">{agents.length} AI agents are available for broadcasts and window replies.</p> : null}
          <DialogFooter>
            <Button onClick={sendTemplate} disabled={!templateId || sending}>Send template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
