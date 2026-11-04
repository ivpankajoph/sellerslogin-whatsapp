"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, FileText, ImageIcon, Italic, Loader2, Plus, Strikethrough, Type, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { wa } from "@/lib/wa";

type ButtonDraft = { type: "quick_reply" | "url" | "phone_number"; text: string; url: string; phoneNumber: string; example: string };

export type TemplateDraft = {
  id?: string;
  name: string;
  category: string;
  language: string;
  headerType: string;
  headerText: string;
  content: string;
  footer: string;
  buttons: ButtonDraft[];
  headerMedia: string;
  previewUrl: string;
};

const HEADER_TYPES = [
  { value: "none", label: "None", icon: X },
  { value: "text", label: "Text", icon: Type },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
  { value: "document", label: "Document", icon: FileText },
] as const;

const EMPTY: TemplateDraft = {
  name: "",
  category: "marketing",
  language: "en_US",
  headerType: "none",
  headerText: "",
  content: "",
  footer: "",
  buttons: [],
  headerMedia: "",
  previewUrl: "",
};

export function templateToDraft(template: Record<string, any> | null | undefined): TemplateDraft {
  if (!template) return EMPTY;
  return {
    id: String(template.id || template._id || ""),
    name: template.name || "",
    category: String(template.category || "marketing").toLowerCase(),
    language: template.language || "en_US",
    headerType: template.headerType || "none",
    headerText: template.headerText || "",
    content: template.content || "",
    footer: template.footer || "",
    buttons: (template.buttons || []).map((button: any) => ({
      type: button.type || "quick_reply",
      text: button.text || "",
      url: button.url || "",
      phoneNumber: button.phoneNumber || "",
      example: button.example?.[0] || "",
    })),
    headerMedia: template.headerImage || template.headerMedia || template.headerImageUrl || "",
    previewUrl: template.previewUrl || "",
  };
}

function bodyError(text: string) {
  const value = text.trim();
  if (!value) return "Body text is required";
  if (/^\{\{[^}]+\}\}/.test(value)) return "Add words before the first variable";
  if (/\{\{[^}]+\}\}$/.test(value)) return "Add words after the last variable";
  return "";
}

function previewHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*(.*?)\*/g, "<b>$1</b>")
    .replace(/_(.*?)_/g, "<i>$1</i>")
    .replace(/~(.*?)~/g, "<s>$1</s>")
    .replace(/\{\{(\d+)\}\}/g, "<span class='rounded bg-sky-100 px-1 text-sky-700'>{{$1}}</span>")
    .replace(/\n/g, "<br>");
}

export function TemplateEditor({ initial, onDone }: { initial?: TemplateDraft; onDone?: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<TemplateDraft>(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(form.id);
  const error = bodyError(form.content);

  const patch = (next: Partial<TemplateDraft>) => setForm((current) => ({ ...current, ...next }));

  const wrap = (marker: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = form.content.slice(start, end) || "text";
    const updated = `${form.content.slice(0, start)}${marker}${selected}${marker}${form.content.slice(end)}`;
    patch({ content: updated });
  };

  const addVariable = () => {
    const next = (form.content.match(/\{\{(\d+)\}\}/g) || []).length + 1;
    const token = `{{${next}}}`;
    const el = bodyRef.current;
    const pos = el?.selectionStart ?? form.content.length;
    patch({ content: `${form.content.slice(0, pos)}${token}${form.content.slice(pos)}` });
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const data = await wa("/upload/template-header", { method: "POST", body });
      patch({
        headerMedia: data.handle || data.url || "",
        previewUrl: data.previewUrl || (form.headerType === "image" ? URL.createObjectURL(file) : ""),
      });
      toast.success("Header media uploaded");
    } catch (uploadError: any) {
      toast.error(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const name = form.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!name) return toast.error("Enter a template name");
    if (error) return toast.error(error);
    const buttons = form.buttons
      .filter((button) => button.text.trim())
      .map((button) => ({
        type: button.type,
        text: button.text.trim(),
        ...(button.type === "url" ? { url: button.url.trim(), ...(button.example ? { example: [button.example.trim()] } : {}) } : {}),
        ...(button.type === "phone_number" ? { phoneNumber: button.phoneNumber.trim() } : {}),
      }));
    const payload = {
      name,
      category: form.category,
      templateType: form.category === "authentication" ? "authentication" : "standard",
      language: form.language,
      headerType: form.headerType === "none" ? null : form.headerType,
      headerText: form.headerType === "text" ? form.headerText.trim() : null,
      headerMedia: ["image", "video", "document"].includes(form.headerType) ? form.headerMedia : null,
      headerImage: ["image", "video", "document"].includes(form.headerType) ? form.headerMedia : null,
      previewUrl: form.previewUrl || null,
      content: form.content,
      footer: form.footer.trim() || null,
      buttons: buttons.length ? buttons : undefined,
      status: "draft",
    };
    setSaving(true);
    try {
      const saved = isEdit
        ? await wa(`/templates/${form.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await wa("/templates", { method: "POST", body: JSON.stringify(payload) });
      const id = saved.id || saved._id || form.id;
      if (id) {
        await wa(`/templates/${id}/submit-approval`, { method: "POST" }).catch((submitError) => {
          toast.warning(submitError.message || "Saved, but Meta submit failed");
        });
      }
      toast.success(isEdit ? "Template updated" : "Template created and submitted");
      if (onDone) onDone();
      else router.push("/templates/manage");
    } catch (saveError: any) {
      toast.error(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Edit template" : "Template details"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1.5 text-sm"><Label>Name</Label><Input value={form.name} disabled={isEdit} onChange={(event) => patch({ name: event.target.value })} placeholder="order_update" /></label>
            <label className="grid gap-1.5 text-sm">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(category) => patch({ category })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="authentication">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <Label>Language</Label>
              <Select value={form.language} onValueChange={(language) => patch({ language })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="pt_BR">Portuguese (BR)</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="space-y-2">
            <Label>Header</Label>
            <div className="flex flex-wrap gap-2">
              {HEADER_TYPES.map((type) => (
                <Button key={type.value} type="button" size="sm" variant={form.headerType === type.value ? "default" : "outline"} onClick={() => patch({ headerType: type.value })}>
                  <type.icon />
                  {type.label}
                </Button>
              ))}
            </div>
            {form.headerType === "text" ? <Input value={form.headerText} maxLength={60} placeholder="Header text" onChange={(event) => patch({ headerText: event.target.value })} /> : null}
            {["image", "video", "document"].includes(form.headerType) ? (
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
                <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="animate-spin" /> : null}
                  Upload {form.headerType}
                </Button>
                {form.headerMedia ? <span className="truncate text-sm text-muted-foreground">Media attached</span> : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Body</Label>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => wrap("*")}><Bold /></Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => wrap("_")}><Italic /></Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => wrap("~")}><Strikethrough /></Button>
                <Button type="button" size="sm" variant="outline" onClick={addVariable}>Add variable</Button>
              </div>
            </div>
            <Textarea ref={bodyRef} value={form.content} onChange={(event) => patch({ content: event.target.value })} className="min-h-36" placeholder="Hi {{1}}, your order {{2}} is ready." />
            {error && form.content ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <label className="grid gap-1.5 text-sm"><Label>Footer</Label><Input value={form.footer} maxLength={60} onChange={(event) => patch({ footer: event.target.value })} placeholder="Optional footer" /></label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Buttons</Label>
              <Button type="button" size="sm" variant="outline" disabled={form.buttons.length >= 3} onClick={() => patch({ buttons: [...form.buttons, { type: "quick_reply", text: "", url: "", phoneNumber: "", example: "" }] })}>
                <Plus /> Add button
              </Button>
            </div>
            {form.buttons.map((button, index) => (
              <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[160px_1fr_1fr_auto]">
                <Select value={button.type} onValueChange={(type: ButtonDraft["type"]) => patch({ buttons: form.buttons.map((item, itemIndex) => itemIndex === index ? { ...item, type } : item) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick_reply">Quick reply</SelectItem>
                    <SelectItem value="url">Website</SelectItem>
                    <SelectItem value="phone_number">Phone</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={button.text} placeholder="Button text" onChange={(event) => patch({ buttons: form.buttons.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })} />
                {button.type === "url" ? <Input value={button.url} placeholder="https://" onChange={(event) => patch({ buttons: form.buttons.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) })} /> : null}
                {button.type === "phone_number" ? <Input value={button.phoneNumber} placeholder="Phone number" onChange={(event) => patch({ buttons: form.buttons.map((item, itemIndex) => itemIndex === index ? { ...item, phoneNumber: event.target.value } : item) })} /> : null}
                <Button type="button" size="icon" variant="ghost" onClick={() => patch({ buttons: form.buttons.filter((_, itemIndex) => itemIndex !== index) })}><X /></Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : isEdit ? "Save and resubmit" : "Create and submit"}</Button>
            {onDone ? <Button type="button" variant="outline" onClick={onDone}>Cancel</Button> : null}
          </div>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-2xl bg-[#e7f8ef] p-4 text-sm">
            {form.headerType === "text" && form.headerText ? <p className="mb-2 font-semibold">{form.headerText}</p> : null}
            {form.previewUrl && form.headerType === "image" ? <img src={form.previewUrl} alt="" className="mb-2 max-h-40 w-full rounded-lg object-cover" /> : null}
            <div dangerouslySetInnerHTML={{ __html: previewHtml(form.content || "Message preview") }} />
            {form.footer ? <p className="mt-2 text-xs text-muted-foreground">{form.footer}</p> : null}
            {form.buttons.filter((button) => button.text).map((button) => (
              <div key={button.text} className="mt-2 rounded-md bg-white px-3 py-1.5 text-center text-primary">{button.text}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
