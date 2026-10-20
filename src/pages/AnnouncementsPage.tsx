import { useCallback, useEffect, useState } from "react";
import { Megaphone, Send, RefreshCw, Loader2, Users, Ban, Search, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";

type Audience = "all" | "pro" | "free" | "dual" | "department" | "users";

// Subset of GET /admin/users/ used by the user picker
interface PickUser {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  department_name: string | null;
  is_pro: boolean;
  is_banned: boolean;
}

function pickUserName(u: PickUser): string {
  const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return name || (u.telegram_username ? `@${u.telegram_username}` : String(u.telegram_id));
}

interface DepartmentItem {
  id: string;
  name: string;
  is_active: boolean;
}

interface Announcement {
  id: string;
  text: string;
  audience: Audience;
  department_name: string | null;
  target_user_label: string | null;
  created_by: string | null;
  created_at: string;
  recipient_count: number;
  sent_count: number;
  pending_count: number;
  failed_count: number;
  cancelled_count: number;
}

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "all", label: "All users", hint: "Everyone who uses the bot" },
  { value: "pro", label: "PRO users", hint: "Users with an active PRO plan" },
  { value: "free", label: "Free users", hint: "Users without PRO" },
  { value: "dual", label: "Dual Degree users", hint: "Users with an active second department" },
  { value: "department", label: "A department", hint: "Main department, plus dual students who have it unlocked" },
  { value: "users", label: "Selected users", hint: "Pick one or more users from the list" },
];

// Keep in sync with MAX_ANNOUNCEMENT_LENGTH in the backend.
const MAX_LENGTH = 3500;

function audienceLabel(a: Announcement): string {
  if (a.audience === "department") return `Department · ${a.department_name || "deleted"}`;
  if (a.audience === "users") {
    return a.recipient_count === 1 && a.target_user_label
      ? `User · ${a.target_user_label}`
      : `Selected users · ${a.recipient_count}`;
  }
  return AUDIENCES.find((x) => x.value === a.audience)?.label || a.audience;
}

function apiErrorDetail(err: unknown): string | undefined {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  // FastAPI validation errors: [{ msg: "..." }]
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg.replace(/^Value error, /, "");
  return undefined;
}

export default function AnnouncementsPage() {
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [departmentId, setDepartmentId] = useState("");
  const [selected, setSelected] = useState<Record<string, PickUser>>({});
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<PickUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [recipients, setRecipients] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const selectedIds = Object.keys(selected);
  const targetReady =
    audience === "department" ? !!departmentId : audience === "users" ? selectedIds.length > 0 : true;

  const selectedKey = selectedIds.sort().join(",");
  const targetPayload = useCallback(
    () => ({
      audience,
      department_id: audience === "department" ? departmentId : undefined,
      user_ids: audience === "users" ? (selectedKey ? selectedKey.split(",") : []) : undefined,
    }),
    [audience, departmentId, selectedKey]
  );

  // Users for the picker: searchable, banned users left out (they never get announcements)
  useEffect(() => {
    if (audience !== "users") return;
    setUsersLoading(true);
    const timer = setTimeout(() => {
      api
        .get("/admin/users/", { params: { limit: 100, search: userSearch.trim() || undefined, is_banned: false } })
        .then((r) => setUserResults(Array.isArray(r.data) ? r.data : []))
        .catch(() => toast.error("Failed to load users"))
        .finally(() => setUsersLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [audience, userSearch]);

  const toggleUser = (u: PickUser) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[u.id]) delete next[u.id];
      else next[u.id] = u;
      return next;
    });

  const allShownSelected = userResults.length > 0 && userResults.every((u) => selected[u.id]);
  const toggleAllShown = () =>
    setSelected((prev) => {
      const next = { ...prev };
      userResults.forEach((u) => {
        if (allShownSelected) delete next[u.id];
        else next[u.id] = u;
      });
      return next;
    });

  const fetchHistory = useCallback(() => {
    setHistoryLoading(true);
    api
      .get("/admin/announcements")
      .then((r) => setHistory(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error("Failed to load announcements"))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    api
      .get("/admin/users/departments")
      .then((r) => Array.isArray(r.data) && setDepartments(r.data))
      .catch(() => {});
    fetchHistory();
  }, [fetchHistory]);

  // Refresh delivery progress while messages are still waiting to be sent
  useEffect(() => {
    if (!history.some((a) => a.pending_count > 0)) return;
    const timer = setInterval(fetchHistory, 15000);
    return () => clearInterval(timer);
  }, [history, fetchHistory]);

  // Live recipient count for the chosen audience
  useEffect(() => {
    setRecipients(null);
    setPreviewError(null);
    if (!targetReady) return;
    const timer = setTimeout(() => {
      api
        .post("/admin/announcements/preview", targetPayload())
        .then((r) => setRecipients(r.data.recipient_count))
        .catch((err) => setPreviewError(apiErrorDetail(err) || "Could not count recipients"));
    }, 400);
    return () => clearTimeout(timer);
  }, [targetReady, targetPayload]);

  const handleSend = async () => {
    setSending(true);
    try {
      const r = await api.post("/admin/announcements", { ...targetPayload(), text: text.trim() });
      toast.success(`📢 Announcement queued for ${r.data.recipient_count} user(s)`);
      setConfirmOpen(false);
      setText("");
      fetchHistory();
    } catch (err) {
      toast.error(apiErrorDetail(err) || "Failed to send announcement");
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async (a: Announcement) => {
    if (!confirm(`Stop sending this announcement to the ${a.pending_count} user(s) who haven't received it yet?`)) return;
    try {
      await api.post(`/admin/announcements/${a.id}/cancel`);
      toast.success("Remaining deliveries cancelled");
      fetchHistory();
    } catch (err) {
      toast.error(apiErrorDetail(err) || "Failed to cancel");
    }
  };

  const canSend = text.trim().length > 0 && targetReady && !!recipients && !previewError;
  const selectedAudience = AUDIENCES.find((a) => a.value === audience);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-primary" /> Announcements
          </h1>
          <p className="text-muted-foreground">
            Send a message to your users through the bot. Users in an exam, AI chat or payment upload get it as soon as they finish.
          </p>
        </div>
        <Button variant="outline" onClick={fetchHistory}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New announcement</CardTitle>
          <CardDescription>Plain text. Line breaks and emoji are kept.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Send to</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{selectedAudience?.hint}</p>
            </div>

            {audience === "department" && (
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          </div>

          {audience === "users" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Users</Label>
                {selectedIds.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected({})}>
                    Clear selection
                  </Button>
                )}
              </div>

              {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(selected).map((u) => (
                    <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
                      {pickUserName(u)}
                      <button
                        type="button"
                        aria-label={`Remove ${pickUserName(u)}`}
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                        onClick={() => toggleUser(u)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="rounded-lg border">
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    className="h-8 border-0 shadow-none focus-visible:ring-0 px-0"
                    placeholder="Search by name, @username or Telegram ID"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  {usersLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                </div>
                {userResults.length > 0 && (
                  <label className="flex items-center gap-3 border-b px-3 py-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox checked={allShownSelected} onCheckedChange={toggleAllShown} />
                    Select all {userResults.length} shown
                  </label>
                )}
                <ScrollArea className="h-64">
                  {userResults.length === 0 && !usersLoading ? (
                    <p className="p-4 text-sm text-muted-foreground">No users found.</p>
                  ) : (
                    userResults.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                      >
                        <Checkbox checked={!!selected[u.id]} onCheckedChange={() => toggleUser(u)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {pickUserName(u)}
                            {u.is_pro && <Badge className="ml-2 bg-amber-500 text-white text-[10px]">PRO</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.telegram_username ? `@${u.telegram_username} · ` : ""}
                            {u.department_name || "No department"} · ID {u.telegram_id}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </ScrollArea>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedIds.length} selected. Search to find more; your selection is kept.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={6}
              maxLength={MAX_LENGTH}
              placeholder="e.g. 🎓 New: Dual Degree! Study two departments with one account…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {text.length}/{MAX_LENGTH}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              {previewError ? (
                <span className="text-destructive">{previewError}</span>
              ) : !targetReady ? (
                <span className="text-muted-foreground">
                  {audience === "users" ? "Select at least one user" : "Choose who to send it to"}
                </span>
              ) : recipients === null ? (
                <span className="text-muted-foreground">Counting recipients…</span>
              ) : (
                <span>
                  <b>{recipients}</b> recipient{recipients === 1 ? "" : "s"}
                </span>
              )}
            </p>
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSend}>
              <Send className="mr-2 h-4 w-4" /> Send announcement
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent announcements</CardTitle>
          <CardDescription>Delivery progress updates automatically while messages are waiting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyLoading && history.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements sent yet.</p>
          ) : (
            history.map((a) => {
              const done = a.sent_count + a.failed_count + a.cancelled_count;
              return (
                <div key={a.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{audienceLabel(a)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                        {a.created_by ? ` · ${a.created_by}` : ""}
                      </span>
                    </div>
                    {a.pending_count > 0 && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleCancel(a)}>
                        <Ban className="mr-1 h-3.5 w-3.5" /> Stop sending
                      </Button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap line-clamp-4">{a.text}</p>
                  <Progress value={a.recipient_count ? (done / a.recipient_count) * 100 : 100} className="h-1.5" />
                  <div className="flex gap-3 text-xs flex-wrap">
                    <span>
                      ✅ Sent <b>{a.sent_count}</b>/{a.recipient_count}
                    </span>
                    {a.pending_count > 0 && (
                      <span className="text-muted-foreground">
                        ⏳ Waiting <b>{a.pending_count}</b> (busy or not yet sent)
                      </span>
                    )}
                    {a.failed_count > 0 && (
                      <span className="text-destructive">
                        ⚠️ Failed <b>{a.failed_count}</b> (blocked the bot)
                      </span>
                    )}
                    {a.cancelled_count > 0 && (
                      <span className="text-muted-foreground">
                        Stopped <b>{a.cancelled_count}</b>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(open) => !sending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send announcement?</DialogTitle>
            <DialogDescription>
              This sends the message below to <b>{recipients}</b> user{recipients === 1 ? "" : "s"} ({selectedAudience?.label}
              {audience === "department" ? ` · ${departments.find((d) => d.id === departmentId)?.name || ""}` : ""}
              {audience === "users" && selectedIds.length <= 3
                ? ` · ${Object.values(selected).map(pickUserName).join(", ")}`
                : ""}
              ). It can't be unsent once delivered.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
            <p className="font-semibold mb-2">📢 Announcement</p>
            {text.trim()}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send to {recipients} user{recipients === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
