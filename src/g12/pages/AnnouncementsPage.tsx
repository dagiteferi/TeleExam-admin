import { useEffect, useState } from "react";
import { Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { g12Api } from "../api";
import { Empty, Loading, PageHeader, StatusBadge, run, useLoad, when } from "../components/kit";
import MessageEditor from "../components/MessageEditor";
import StudentPicker, { type PickedStudent } from "../components/StudentPicker";

interface Announcement {
  id: string;
  preview: string;
  audience: string;
  stream: string | null;
  recipient_count: number;
  status: string;
  created_at: string;
  edited_at: string | null;
  sent: number;
  failed: number;
  updating: number;
}

interface Detail extends Announcement {
  text: string;
}

const MAX = 4000;

function EditDialog({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const { data, loading } = useLoad(async () => (await g12Api.get<Detail>(`/announcements/${id}`)).data, [id]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setText(data.text);
  }, [data]);

  const save = async () => {
    setBusy(true);
    const ok = await run(() => g12Api.patch(`/announcements/${id}`, { text: text.trim() }),
      "Saved. Students who already got it will see the new text in their chat.");
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit announcement</DialogTitle>
          <DialogDescription>The message is changed in place in every student's chat. Students still waiting get the new text.</DialogDescription>
        </DialogHeader>
        {loading || !data ? <Loading /> : <MessageEditor value={text} onChange={setText} maxLength={MAX} rows={7} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !text.trim() || text.trim() === data?.text} onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function G12AnnouncementsPage() {
  const { data, loading, reload, setData } = useLoad(async () => (await g12Api.get<Announcement[]>("/announcements")).data);
  const [text, setText] = useState("");
  const [audience, setAudience] = useState("all");
  const [stream, setStream] = useState("natural");
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  const busy = data?.some((a) => a.status !== "done" || a.updating > 0);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(async () => {
      try {
        setData((await g12Api.get<Announcement[]>("/announcements")).data);
      } catch {
        /* keep the last list */
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [busy, setData]);

  const send = async () => {
    setSending(true);
    const body: Record<string, unknown> = { text: text.trim(), audience };
    if (audience === "stream") body.stream = stream;
    if (audience === "user") body.user_id = student?.id;
    let recipients = 0;
    const ok = await run(async () => {
      recipients = (await g12Api.post<{ recipients: number }>("/announcements", body)).data.recipients;
    }, "Announcement queued.");
    setSending(false);
    if (ok) {
      toast.message(`Sending to ${recipients} student(s) in the background.`);
      setText("");
      reload();
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const ok = await run(() => g12Api.delete(`/announcements/${deleting.id}`),
      "Deleted. It is being removed from students' chats.");
    if (ok) {
      setDeleting(null);
      reload();
    }
  };

  const hint = !text.trim() ? "Write a message." : audience === "user" && !student ? "Choose a student." : null;

  return (
    <>
      <PageHeader title="Announcements" description="Send a message through the bot. Banned students are skipped. You can edit or delete it after sending." />
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">New announcement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <MessageEditor value={text} onChange={setText} maxLength={MAX} rows={6} placeholder="Write the message students will receive…" />
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label>Send to</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All students</SelectItem><SelectItem value="stream">One stream</SelectItem>
                  <SelectItem value="user">One student</SelectItem></SelectContent>
              </Select></div>
            {audience === "stream" && (
              <div className="space-y-1"><Label>Stream</Label>
                <Select value={stream} onValueChange={setStream}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="natural">Natural Science</SelectItem><SelectItem value="social">Social Science</SelectItem></SelectContent>
                </Select></div>
            )}
            {audience === "user" && (
              <div className="space-y-1 w-full max-w-md"><Label>Student</Label><StudentPicker value={student} onChange={setStudent} /></div>
            )}
            <Button disabled={!!hint || sending} onClick={send}><Send className="h-4 w-4 mr-1" />Send</Button>
            {hint && <span className="text-xs text-muted-foreground pb-2">{hint}</span>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {loading && !data ? <Loading /> : !data?.length ? <Empty text="No announcements yet." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Message</TableHead><TableHead>To</TableHead><TableHead>Progress</TableHead>
                <TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-md">
                      <p className="line-clamp-2 text-sm">{a.preview}</p>
                      {a.edited_at && <p className="text-[11px] text-muted-foreground">Edited {when(a.edited_at)}</p>}
                    </TableCell>
                    <TableCell className="capitalize">{a.audience === "stream" ? a.stream : a.audience === "user" ? "One student" : "All"}</TableCell>
                    <TableCell className="w-48">
                      <Progress value={a.recipient_count ? ((a.sent + a.failed) / a.recipient_count) * 100 : 0} />
                      <p className="text-xs text-muted-foreground mt-1">{a.sent} sent · {a.failed} failed · {a.recipient_count} total</p>
                    </TableCell>
                    <TableCell>
                      {a.updating > 0 ? <Badge variant="secondary">Updating {a.updating}</Badge> : <StatusBadge value={a.status} />}
                    </TableCell>
                    <TableCell className="text-xs">{when(a.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a.id)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(a)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {editing && <EditDialog id={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete this announcement?</DialogTitle>
              <DialogDescription>
                It is removed from every student's chat, and students still waiting won't get it.
                Telegram only lets the bot delete messages sent in the last 48 hours; older ones stay in the chat.
              </DialogDescription>
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
