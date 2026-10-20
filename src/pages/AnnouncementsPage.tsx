import { useCallback, useEffect, useState } from "react";
import {
  Megaphone,
  Send,
  RefreshCw,
  Loader2,
  Users,
  Ban,
  Search,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ListChecks,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type DeliveryStatus = "pending" | "sent" | "failed" | "cancelled";

interface Delivery {
  user_id: string;
  name: string;
  telegram_username: string | null;
  telegram_id: number;
  status: DeliveryStatus;
  attempts: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  error: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleString();
}

// Plain-language reason for each recipient's state
function deliveryReason(d: Delivery): string {
  if (d.status === "sent") return `Delivered ${timeAgo(d.sent_at)}`;
  if (d.status === "cancelled") return "You stopped this announcement before it reached them";
  if (d.status === "failed") {
    const e = (d.error || "").toLowerCase();
    if (e.includes("blocked")) return "Blocked the bot — can't receive messages";
    if (e.includes("deactivated")) return "Telegram account deleted";
    if (e.includes("chat not found")) return "Never started the bot";
    return d.error || "Failed";
  }
  return d.attempts > 0
    ? `Busy in the bot (exam, AI chat or payment) — gets it as soon as they finish · checked ${timeAgo(d.last_attempt_at)}`
    : "In the queue — sending now";
}

const STATUS_STYLE: Record<DeliveryStatus, { label: string; className: string }> = {
  sent: { label: "Delivered", className: "bg-emerald-600 hover:bg-emerald-600 text-white" },
  pending: { label: "Waiting", className: "bg-amber-500 hover:bg-amber-500 text-white" },
  failed: { label: "Failed", className: "bg-destructive hover:bg-destructive text-destructive-foreground" },
  cancelled: { label: "Stopped", className: "bg-muted text-muted-foreground hover:bg-muted" },
};

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [detailsFor, setDetailsFor] = useState<Announcement | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | DeliveryStatus>("all");
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
    const timer = setInterval(fetchHistory, 5000);
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

  const loadDeliveries = useCallback((a: Announcement) => {
    setDeliveriesLoading(true);
    api
      .get(`/admin/announcements/${a.id}/deliveries`)
      .then((r) => setDeliveries(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error("Failed to load recipients"))
      .finally(() => setDeliveriesLoading(false));
  }, []);

  const openDetails = (a: Announcement, filter: "all" | DeliveryStatus = "all") => {
    setDetailsFor(a);
    setDeliveryFilter(filter);
    setDeliveries([]);
    loadDeliveries(a);
  };

  // Keep the open recipient list live while messages are still waiting
  useEffect(() => {
    if (!detailsFor) return;
    const current = history.find((a) => a.id === detailsFor.id);
    if (current && current !== detailsFor) {
      setDetailsFor(current);
      loadDeliveries(current);
    }
  }, [history, detailsFor, loadDeliveries]);

  const shownDeliveries = deliveryFilter === "all" ? deliveries : deliveries.filter((d) => d.status === deliveryFilter);

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
          <CardDescription>
            Counts update every few seconds while messages are waiting. Click a number to see exactly who it is.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {historyLoading && history.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements sent yet.</p>
          ) : (
            history.map((a) => {
              const done = a.sent_count + a.failed_count + a.cancelled_count;
              const isOpen = !!expanded[a.id];
              const long = a.text.length > 220 || a.text.split("\n").length > 4;
              return (
                <div key={a.id} className="rounded-xl border bg-card overflow-hidden">
                  {/* Header: audience, who and when */}
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b bg-muted/30 px-4 py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-semibold">
                        {audienceLabel(a)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                        {a.created_by ? ` · by ${a.created_by}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {a.pending_count > 0 && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleCancel(a)}>
                          <Ban className="mr-1 h-3.5 w-3.5" /> Stop sending
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openDetails(a)}>
                        <ListChecks className="mr-1 h-3.5 w-3.5" /> Recipients
                      </Button>
                    </div>
                  </div>

                  {/* The message, as users see it */}
                  <div className="px-4 py-3">
                    <div className="rounded-lg border-l-4 border-primary bg-muted/40 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        📢 Announcement
                      </p>
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${!isOpen && long ? "line-clamp-4" : ""}`}>
                        {a.text}
                      </p>
                      {long && (
                        <button
                          type="button"
                          className="mt-1 text-xs font-medium text-primary inline-flex items-center gap-0.5"
                          onClick={() => setExpanded((e) => ({ ...e, [a.id]: !isOpen }))}
                        >
                          {isOpen ? (
                            <>
                              Show less <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              Show full message <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delivery summary */}
                  <div className="px-4 pb-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {done}/{a.recipient_count} processed
                      </span>
                      <span>{a.recipient_count ? Math.round((a.sent_count / a.recipient_count) * 100) : 0}% delivered</span>
                    </div>
                    <Progress value={a.recipient_count ? (done / a.recipient_count) * 100 : 100} className="h-2" />
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => openDetails(a, "sent")}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left hover:bg-emerald-500/15"
                      >
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Delivered
                        </span>
                        <span className="text-xl font-bold">{a.sent_count}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openDetails(a, "pending")}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left hover:bg-amber-500/15"
                      >
                        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" /> Waiting
                        </span>
                        <span className="text-xl font-bold">{a.pending_count}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openDetails(a, "failed")}
                        className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-left hover:bg-destructive/15"
                      >
                        <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> Not received
                        </span>
                        <span className="text-xl font-bold">{a.failed_count + a.cancelled_count}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Recipients dialog: who got it, who is waiting and why, who failed and why */}
      <Dialog open={!!detailsFor} onOpenChange={(open) => !open && setDetailsFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" /> Recipients
            </DialogTitle>
            <DialogDescription>
              {detailsFor ? `${audienceLabel(detailsFor)} · sent ${new Date(detailsFor.created_at).toLocaleString()}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detailsFor && (
            <Tabs value={deliveryFilter} onValueChange={(v) => setDeliveryFilter(v as typeof deliveryFilter)}>
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="all">All ({detailsFor.recipient_count})</TabsTrigger>
                <TabsTrigger value="sent">Delivered ({detailsFor.sent_count})</TabsTrigger>
                <TabsTrigger value="pending">Waiting ({detailsFor.pending_count})</TabsTrigger>
                <TabsTrigger value="failed">Failed ({detailsFor.failed_count})</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <ScrollArea className="flex-1 min-h-[200px] max-h-[55vh] rounded-lg border">
            {deliveriesLoading && deliveries.length === 0 ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading recipients…
              </div>
            ) : shownDeliveries.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nobody in this list.</p>
            ) : (
              shownDeliveries.map((d) => (
                <div key={d.user_id} className="flex items-start justify-between gap-3 border-b px-3 py-2.5 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.telegram_username ? `@${d.telegram_username} · ` : ""}ID {d.telegram_id}
                    </p>
                    <p className="text-xs mt-0.5">{deliveryReason(d)}</p>
                  </div>
                  <Badge className={`shrink-0 ${STATUS_STYLE[d.status]?.className || ""}`}>
                    {STATUS_STYLE[d.status]?.label || d.status}
                  </Badge>
                </div>
              ))
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetailsFor(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
