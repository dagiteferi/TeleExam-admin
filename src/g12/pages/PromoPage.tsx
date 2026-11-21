import { useState } from "react";
import { Copy, Gift, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { g12Api } from "../api";
import { Empty, Loading, PageHeader, run, useLoad, when } from "../components/kit";
import MessageEditor, { MessagePreview } from "../components/MessageEditor";
import StudentPicker, { studentName, type PickedStudent } from "../components/StudentPicker";

interface Promo {
  id: string;
  code: string;
  welcome_message: string;
  click_count: number;
  students: number;
  active_students: number;
  is_active: boolean;
  created_at: string;
  link: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_username: string | null;
  owner_telegram_id: number | null;
}

const MAX = 1000;
const CODE = /^[A-Z0-9_]{3,32}$/;
const DEFAULT_OFFER = "You're eligible for an **exclusive offer** through this invitation.\n\n"
  + "Start exploring TeleExam 12 and make your Grade 12 exam preparation more effective!";

const cleanCode = (v: string) => v.toUpperCase().replace(/[\s-]+/g, "_").replace(/[^A-Z0-9_]/g, "").slice(0, 32);
const ownerLabel = (p: Promo) => p.owner_username ? `@${p.owner_username}` : p.owner_name || "a friend";

function offerText(message: string, from: string | null) {
  const invited = from ? `🤝 You joined through a special invitation from **${from}**\n` : "";
  return `**Welcome to TeleExam 12, Sara!**\nWe're glad to have you here!\n\n${invited}🎁 **A Special Offer Awaits You!**\n${message}`;
}

function copy(link: string) {
  navigator.clipboard.writeText(link);
  toast.success("Link copied.");
}

function NewLink({ onCreated }: { onCreated: () => void }) {
  const [kind, setKind] = useState<"student" | "general">("student");
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(DEFAULT_OFFER);
  const [busy, setBusy] = useState(false);

  const problem = kind === "student"
    ? (!student ? "Choose a student first." : null)
    : (!CODE.test(code) ? "Code must be 3 to 32 letters, numbers or _." : null);
  const tooShort = message.trim().length < 3 ? "Write a message (at least 3 characters)." : null;
  const hint = problem || tooShort;

  const create = async () => {
    setBusy(true);
    const body = kind === "student"
      ? { user_id: student!.id, welcome_message: message.trim(), ...(code ? { code } : {}) }
      : { code, welcome_message: message.trim() };
    let created: Promo | null = null;
    const ok = await run(async () => { created = (await g12Api.post<Promo>("/promo-links", body)).data; }, "Link created.");
    setBusy(false);
    if (ok && created) {
      copy((created as Promo).link);
      setStudent(null);
      setCode("");
      setMessage(DEFAULT_OFFER);
      onCreated();
    }
  };

  const from = kind === "student" && student ? (student.username ? `@${student.username}` : studentName(student)) : null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">New link</CardTitle>
        <CardDescription>When someone opens the link, the bot greets them with your special offer message.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={kind} onValueChange={(v) => setKind(v as "student" | "general")}>
          <TabsList>
            <TabsTrigger value="student"><Gift className="h-4 w-4 mr-1" />Special link for a student</TabsTrigger>
            <TabsTrigger value="general"><Megaphone className="h-4 w-4 mr-1" />Campaign code</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {kind === "student" ? (
              <>
                <div className="space-y-1">
                  <Label>Student</Label>
                  <StudentPicker value={student} onChange={setStudent} />
                  <p className="text-xs text-muted-foreground">New students who join with this link count as this student's invites.</p>
                </div>
                <div className="space-y-1">
                  <Label>Code (optional)</Label>
                  <Input value={code} onChange={(e) => setCode(cleanCode(e.target.value))} placeholder="Made from the student's name if empty" />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label>Code</Label>
                <Input value={code} onChange={(e) => setCode(cleanCode(e.target.value))} placeholder="AAU_2027" />
                <p className="text-xs text-muted-foreground">Letters, numbers and _ only. Spaces become _.</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Special offer message</Label>
              <MessageEditor value={message} onChange={setMessage} maxLength={MAX} rows={5} previewTitle="" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>What a new student sees <span className="font-normal text-muted-foreground">(example name)</span></Label>
            <MessagePreview text={offerText(message.trim() || "…", kind === "student" ? from ?? "the student" : null)} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button disabled={!!hint || busy} onClick={create}><Plus className="h-4 w-4 mr-1" />Create link</Button>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function EditDialog({ promo, onClose, onSaved }: { promo: Promo; onClose: () => void; onSaved: () => void }) {
  const [message, setMessage] = useState(promo.welcome_message);
  const save = async () => {
    if (await run(() => g12Api.patch(`/promo-links/${promo.id}`, { welcome_message: message.trim() }), "Message saved.")) onSaved();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit message · {promo.code}</DialogTitle>
          <DialogDescription>New visitors see the new message right away.</DialogDescription>
        </DialogHeader>
        <MessageEditor value={message} onChange={setMessage} maxLength={MAX} rows={5} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={message.trim().length < 3} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function G12PromoPage() {
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<Promo[]>("/promo-links")).data);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [deleting, setDeleting] = useState<Promo | null>(null);

  const toggle = async (p: Promo, is_active: boolean) => {
    if (await run(() => g12Api.patch(`/promo-links/${p.id}`, { is_active }), is_active ? "Link turned on." : "Link turned off.")) reload();
  };
  const remove = async () => {
    if (deleting && await run(() => g12Api.delete(`/promo-links/${deleting.id}`), "Link deleted.")) {
      setDeleting(null);
      reload();
    }
  };

  return (
    <>
      <PageHeader title="Promo & Special Links" description="Give a student a personal invite link with a special offer, or make a code for a campaign." />
      <NewLink onCreated={reload} />
      <Card>
        <CardContent className="p-0">
          {loading ? <Loading /> : !data?.length ? <Empty text="No links yet." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Link</TableHead><TableHead>For</TableHead><TableHead>Message</TableHead>
                <TableHead>Opened</TableHead><TableHead>Joined</TableHead><TableHead>Created</TableHead><TableHead>On</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell>
                      {p.owner_id ? (
                        <div><p className="font-medium">{p.owner_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{p.owner_username ? `@${p.owner_username} · ` : ""}ID {p.owner_telegram_id}</p></div>
                      ) : <Badge variant="secondary">Campaign</Badge>}
                    </TableCell>
                    <TableCell className="max-w-xs"><p className="line-clamp-2 text-sm">{p.welcome_message}</p></TableCell>
                    <TableCell>{p.click_count}</TableCell>
                    <TableCell title="Chose a stream / started the bot">{p.active_students} / {p.students}</TableCell>
                    <TableCell className="text-xs">{when(p.created_at)}</TableCell>
                    <TableCell><Switch checked={p.is_active} onCheckedChange={(v) => toggle(p, v)} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => copy(p.link)}><Copy className="h-3 w-3 mr-1" />Copy</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label="Edit message"><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(p)} aria-label="Delete link"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground mt-2">Opened: times the link was tapped. Joined: students who chose a stream / all who started with it.</p>
      {editing && <EditDialog promo={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {deleting.code}?</DialogTitle>
              <DialogDescription>The link stops working. Students who already joined keep their accounts. To pause it instead, turn it off.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="destructive" onClick={remove}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
