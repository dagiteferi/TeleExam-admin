import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { g12Api } from "../api";
import { useG12Auth } from "../auth";
import { Empty, Loading, PageHeader, StatusBadge, run, useLoad, when } from "../components/kit";

interface Student {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  stream: string | null;
  plan: string;
  banned: boolean;
  is_flagged: boolean;
  can_record: boolean;
  created_at: string;
  last_seen_at: string | null;
}

interface StudentDetail extends Student {
  invite_code: string;
  invites: { counted: number; pending: number };
  sessions: { total: number; exams: number; answered: number; avg_score: string | null };
  payments: { id: string; status: string; amount: string; created_at: string }[];
  subscriptions: { plan: string; starts_at: string; ends_at: string | null; revoked_at: string | null }[];
  bans: { reason: string; banned_until: string | null; created_at: string; lifted_at: string | null }[];
}

type ActionKey = "pro" | "full" | "revoke" | "ban" | "unban" | "stream" | "reset";

interface ActionDef {
  title: string;
  button: string;
  path: string;
  danger?: boolean;
  withDate?: string;
  reasons: string[];
  success: string;
}

const ACTIONS: Record<ActionKey, ActionDef> = {
  pro: { title: "Give PRO", button: "Give PRO", path: "grant-pro", withDate: "PRO until (optional)", success: "PRO given.",
    reasons: ["Paid in person or by phone", "Prize or competition winner", "Compensation for a problem", "Partner school student"] },
  full: { title: "Give full access", button: "Give full access", path: "grant-pro", withDate: "Full access until (optional)",
    success: "Full access given.", reasons: ["Marketing team member", "Teacher or content reviewer", "Test account"] },
  revoke: { title: "Remove PRO", button: "Remove PRO", path: "revoke-pro", danger: true, success: "PRO removed.",
    reasons: ["Payment was refunded", "Trial period ended", "Given by mistake"] },
  ban: { title: "Ban student", button: "Ban", path: "ban", danger: true, withDate: "Ban until (optional, empty = until further notice)",
    success: "Student banned.", reasons: ["Sharing or selling exam questions", "Using many accounts", "Abusive behaviour", "Fake payment receipt"] },
  unban: { title: "Unban student", button: "Unban", path: "unban", success: "Student unbanned.",
    reasons: ["Appeal accepted", "Banned by mistake", "Ban period served"] },
  stream: { title: "Change stream", button: "Change stream", path: "stream", success: "Stream changed.",
    reasons: ["Student chose the wrong stream", "Student moved to another stream at school"] },
  reset: { title: "Reset all data", button: "Reset everything", path: "reset", danger: true,
    success: "Student reset. They start again from the beginning.",
    reasons: ["Student asked to start over", "Test account", "Wrong stream and old progress"] },
};

const name = (s: Student) => [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";
const ALL = "all";

function ActionDialog({ action, student, onClose, onDone }: {
  action: ActionKey; student: StudentDetail; onClose: () => void; onDone: () => void;
}) {
  const def = ACTIONS[action];
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [stream, setStream] = useState(student.stream === "natural" ? "social" : "natural");
  const [busy, setBusy] = useState(false);
  const [removeAccess, setRemoveAccess] = useState(false);

  const submit = async () => {
    setBusy(true);
    const date = until ? new Date(`${until}T23:59:59`).toISOString() : null;
    const body: Record<string, unknown> = { reason: reason.trim() };
    if (action === "pro" || action === "full") Object.assign(body, { plan: action, until: date });
    if (action === "ban") body.until = date;
    if (action === "stream") body.stream = stream;
    if (action === "reset") body.remove_access = removeAccess;
    const ok = await run(() => g12Api.post(`/users/${student.id}/${def.path}`, body),
      `${def.success} The student was told in the bot.`);
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{def.title}: {name(student)}</DialogTitle>
          <DialogDescription>The student gets a message about this in the bot.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {action === "stream" && (
            <div className="space-y-1"><Label>New stream</Label>
              <Select value={stream} onValueChange={setStream}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="natural">Natural Science</SelectItem><SelectItem value="social">Social Science</SelectItem></SelectContent>
              </Select></div>
          )}
          <div className="space-y-2">
            <Label>Reason</Label>
            <div className="flex flex-wrap gap-2">
              {def.reasons.map((r) => (
                <Button key={r} type="button" size="sm" variant={reason === r ? "default" : "outline"} onClick={() => setReason(r)}>{r}</Button>
              ))}
            </div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Choose one above or type your own" />
            {action === "ban" && <p className="text-xs text-muted-foreground">The student sees this reason.</p>}
          </div>
          {action === "reset" && (
            <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p>This deletes the student's exams, practice history, chapter progress, saved questions, study plans and
                today's AI use, and clears their stream. Next time they open the bot they start from the beginning and choose a stream again.</p>
              <p className="text-xs text-muted-foreground">Payments, bans and invites are kept. This cannot be undone.</p>
              {student.plan !== "free" && (
                <label className="flex items-center gap-2"><Switch checked={removeAccess} onCheckedChange={setRemoveAccess} />
                  Also remove their {student.plan === "full" ? "full access" : "PRO"}</label>
              )}
            </div>
          )}
          {def.withDate && (
            <div className="space-y-1"><Label>{def.withDate}</Label>
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={def.danger ? "destructive" : "default"} disabled={reason.trim().length < 3 || busy} onClick={submit}>{def.button}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useG12Auth();
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<StudentDetail>(`/users/${id}`)).data, [id]);
  const [action, setAction] = useState<ActionKey | null>(null);
  const manage = can("admin");

  const changed = () => {
    setAction(null);
    reload();
    onChanged();
  };
  const record = async (allowed: boolean) => {
    if (await run(() => g12Api.post(`/users/${id}/screen-recording`, { allowed }),
      allowed ? "Screen recording allowed. The student was told." : "Screen recording turned off. The student was told.")) changed();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{data ? name(data) : "Student"}</DialogTitle></DialogHeader>
        {loading && !data ? <Loading /> : data && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Telegram</span><span>{data.telegram_id}{data.username ? ` · @${data.username}` : ""}</span>
              <span className="text-muted-foreground">Stream</span><span className="capitalize">{data.stream ?? "not chosen"}</span>
              <span className="text-muted-foreground">Plan</span><span><StatusBadge value={data.plan} /></span>
              <span className="text-muted-foreground">Status</span>
              <span className="space-x-1">{data.banned ? <StatusBadge value="banned" /> : <StatusBadge value="active" />}
                {data.is_flagged && <StatusBadge value="flagged" />}</span>
              <span className="text-muted-foreground">Invites</span><span>{data.invites.counted} counted · {data.invites.pending} waiting · code {data.invite_code}</span>
              <span className="text-muted-foreground">Study</span>
              <span>{data.sessions.total} sessions · {data.sessions.exams} exams · {data.sessions.answered} answers · avg {data.sessions.avg_score ?? "—"}%</span>
              <span className="text-muted-foreground">Joined</span><span>{when(data.created_at)}</span>
              <span className="text-muted-foreground">Last seen</span><span>{when(data.last_seen_at)}</span>
            </div>
            {manage && (
              <div className="space-y-3 border-t pt-4">
                <p className="font-medium">Actions</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setAction("pro")}>Give PRO</Button>
                  <Button size="sm" variant="outline" onClick={() => setAction("full")}>Give full access</Button>
                  {data.plan !== "free" && <Button size="sm" variant="outline" onClick={() => setAction("revoke")}>Remove PRO</Button>}
                  <Button size="sm" variant="outline" onClick={() => setAction("stream")}>Change stream</Button>
                  {data.banned
                    ? <Button size="sm" variant="outline" onClick={() => setAction("unban")}>Unban</Button>
                    : <Button size="sm" variant="destructive" onClick={() => setAction("ban")}>Ban</Button>}
                  <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:text-destructive"
                    onClick={() => setAction("reset")}>Reset all data</Button>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div><p className="font-medium">Allow screen recording</p>
                    <p className="text-xs text-muted-foreground">For the marketing team. The student is told when this changes.</p></div>
                  <Switch checked={data.can_record} onCheckedChange={record} />
                </div>
              </div>
            )}
            {data.payments.length > 0 && (
              <div className="border-t pt-4"><p className="font-medium mb-2">Payments</p>
                {data.payments.map((p) => <p key={p.id}>{when(p.created_at)} · {p.amount} ETB · <StatusBadge value={p.status} /></p>)}</div>
            )}
            {data.subscriptions.length > 0 && (
              <div className="border-t pt-4"><p className="font-medium mb-2">Plans</p>
                {data.subscriptions.map((s, i) => <p key={i} className="capitalize">{s.plan} · {when(s.starts_at)} → {s.ends_at ? when(s.ends_at) : "no end date"}{s.revoked_at ? " · removed" : ""}</p>)}</div>
            )}
            {data.bans.length > 0 && (
              <div className="border-t pt-4"><p className="font-medium mb-2">Bans</p>
                {data.bans.map((b, i) => <p key={i}>{when(b.created_at)} · {b.reason}{b.lifted_at ? " · lifted" : ""}</p>)}</div>
            )}
          </div>
        )}
        {data && action && <ActionDialog action={action} student={data} onClose={() => setAction(null)} onDone={changed} />}
      </DialogContent>
    </Dialog>
  );
}

export default function G12StudentsPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState(params.get("plan") ?? ALL);
  const [stream, setStream] = useState(ALL);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data, loading, reload } = useLoad(async () => (await g12Api.get<{ items: Student[] }>("/users", {
    params: { q: search || undefined, plan: plan === ALL ? undefined : plan, stream: stream === ALL ? undefined : stream, limit: 100 },
  })).data.items, [search, plan, stream]);

  const filtered = query !== "" || plan !== ALL || stream !== ALL;
  const clear = () => {
    setQuery("");
    setSearch("");
    setPlan(ALL);
    setStream(ALL);
  };

  return (
    <>
      <PageHeader title="Students" description="Search students and manage their plan, stream and access." />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="max-w-xs" placeholder="Search name, @username or Telegram ID" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All plans</SelectItem><SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">PRO</SelectItem><SelectItem value="full">Full</SelectItem></SelectContent>
        </Select>
        <Select value={stream} onValueChange={setStream}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All streams</SelectItem><SelectItem value="natural">Natural</SelectItem>
            <SelectItem value="social">Social</SelectItem></SelectContent>
        </Select>
        {filtered && <Button variant="ghost" onClick={clear}><X className="h-4 w-4 mr-1" />Clear filters</Button>}
      </div>
      <Card>
        <CardContent className="p-0">
          {loading && !data ? <Loading /> : !data?.length ? <Empty text="No students found." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Telegram</TableHead><TableHead>Stream</TableHead>
                <TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Last seen</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpen(s.id)}>
                    <TableCell className="font-medium">{name(s)}</TableCell>
                    <TableCell>{s.username ? `@${s.username}` : s.telegram_id}</TableCell>
                    <TableCell className="capitalize">{s.stream ?? "—"}</TableCell>
                    <TableCell><StatusBadge value={s.plan} /></TableCell>
                    <TableCell className="space-x-1">{s.banned ? <StatusBadge value="banned" /> : <StatusBadge value="active" />}
                      {s.is_flagged && <StatusBadge value="flagged" />}</TableCell>
                    <TableCell>{when(s.last_seen_at)}</TableCell>
                    <TableCell><Button size="sm" variant="outline">Open</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {open && <StudentDialog id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}
