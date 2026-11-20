import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const name = (s: Student) => [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";
const ALL = "all";

function StudentDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useG12Auth();
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<StudentDetail>(`/users/${id}`)).data, [id]);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [stream, setStream] = useState("");
  const manage = can("admin");

  const act = async (path: string, body: object, message: string) => {
    if (await run(() => g12Api.post(`/users/${id}/${path}`, body), message)) {
      reload();
      onChanged();
    }
  };
  const date = until ? new Date(`${until}T23:59:59`).toISOString() : null;
  const needsReason = reason.trim().length < 3;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{data ? name(data) : "Student"}</DialogTitle></DialogHeader>
        {loading || !data ? <Loading /> : (
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
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1"><Label>Reason (needed for every change)</Label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Paid in person" /></div>
                  <div className="space-y-1"><Label>Until (optional)</Label>
                    <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={needsReason} onClick={() => act("grant-pro", { plan: "pro", until: date, reason }, "PRO given.")}>Give PRO</Button>
                  <Button size="sm" variant="outline" disabled={needsReason} onClick={() => act("grant-pro", { plan: "full", until: date, reason }, "Full access given.")}>Give full access</Button>
                  <Button size="sm" variant="outline" disabled={needsReason} onClick={() => act("revoke-pro", { reason }, "PRO removed.")}>Remove PRO</Button>
                  {data.banned
                    ? <Button size="sm" variant="outline" disabled={needsReason} onClick={() => act("unban", { reason }, "Student unbanned.")}>Unban</Button>
                    : <Button size="sm" variant="destructive" disabled={needsReason} onClick={() => act("ban", { reason, until: date }, "Student banned.")}>Ban</Button>}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1"><Label>Change stream</Label>
                    <Select value={stream} onValueChange={setStream}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="Choose" /></SelectTrigger>
                      <SelectContent><SelectItem value="natural">Natural</SelectItem><SelectItem value="social">Social</SelectItem></SelectContent>
                    </Select></div>
                  <Button size="sm" variant="outline" disabled={!stream || needsReason} onClick={() => act("stream", { stream, reason }, "Stream changed.")}>Change stream</Button>
                  <div className="flex items-center gap-2 ml-auto">
                    <Label>Allow screen recording</Label>
                    <Switch checked={data.can_record} onCheckedChange={(allowed) => act("screen-recording", { allowed }, "Saved.")} />
                  </div>
                </div>
              </div>
            )}
            {data.payments.length > 0 && (
              <div className="border-t pt-4"><p className="font-medium mb-2">Payments</p>
                {data.payments.map((p) => <p key={p.id}>{when(p.created_at)} · {p.amount} · <StatusBadge value={p.status} /></p>)}</div>
            )}
            {data.subscriptions.length > 0 && (
              <div className="border-t pt-4"><p className="font-medium mb-2">Plans</p>
                {data.subscriptions.map((s, i) => <p key={i} className="capitalize">{s.plan} · {when(s.starts_at)} → {s.ends_at ? when(s.ends_at) : "no end"}{s.revoked_at ? " · removed" : ""}</p>)}</div>
            )}
            {data.bans.length > 0 && (
              <div className="border-t pt-4"><p className="font-medium mb-2">Bans</p>
                {data.bans.map((b, i) => <p key={i}>{when(b.created_at)} · {b.reason}{b.lifted_at ? " · lifted" : ""}</p>)}</div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function G12StudentsPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState(ALL);
  const [stream, setStream] = useState(ALL);
  const [open, setOpen] = useState<string | null>(null);
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<{ items: Student[] }>("/users", {
    params: { q: search || undefined, plan: plan === ALL ? undefined : plan, stream: stream === ALL ? undefined : stream, limit: 100 },
  })).data.items, [search, plan, stream]);

  return (
    <>
      <PageHeader title="Students" description="Search students and manage their plan, stream and access." />
      <form className="flex flex-wrap gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); }}>
        <Input className="max-w-xs" placeholder="Name, @username or Telegram ID" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" variant="outline"><Search className="h-4 w-4 mr-1" />Search</Button>
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
      </form>
      <Card>
        <CardContent className="p-0">
          {loading ? <Loading /> : !data?.length ? <Empty text="No students found." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Telegram</TableHead><TableHead>Stream</TableHead>
                <TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Last seen</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{name(s)}</TableCell>
                    <TableCell>{s.username ? `@${s.username}` : s.telegram_id}</TableCell>
                    <TableCell className="capitalize">{s.stream ?? "—"}</TableCell>
                    <TableCell><StatusBadge value={s.plan} /></TableCell>
                    <TableCell className="space-x-1">{s.banned ? <StatusBadge value="banned" /> : <StatusBadge value="active" />}
                      {s.is_flagged && <StatusBadge value="flagged" />}</TableCell>
                    <TableCell>{when(s.last_seen_at)}</TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => setOpen(s.id)}>Open</Button></TableCell>
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
