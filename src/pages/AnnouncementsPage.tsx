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
  ChevronLeft,
  ChevronRight,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";
import AnnouncementEditor from "@/components/AnnouncementEditor";
import { FormattedAnnouncement } from "@/lib/announcementFormat";

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
  version: number; // 1 = never edited
  updating_count: number; // delivered copies the bot is still updating to the latest text
  untracked_count: number; // delivered before message ids were recorded: can't be edited or deleted in chats
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

const PAGE_SIZE = 10;

type StatusFilter = "all" | "sending" | "completed" | "failures";

function isSending(a: Announcement): boolean {
  return a.pending_count > 0 || a.updating_count > 0;
}

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
  const [composeOpen, setComposeOpen] = useState(false);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [listSearch, setListSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<"all" | Audience>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [detailsFor, setDetailsFor] = useState<Announcement | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | DeliveryStatus>("all");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  // Refresh progress while messages are still waiting to be sent or edited
  useEffect(() => {
    if (!history.some((a) => a.pending_count > 0 || a.updating_count > 0)) return;
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
      setComposeOpen(false);
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

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setEditText(a.text);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await api.put(`/admin/announcements/${editing.id}`, { text: editText.trim() });
      const edits = editing.sent_count - editing.untracked_count;
      toast.success(edits > 0 ? `Saved. Updating it in ${edits} chat(s)…` : "Announcement updated");
      setEditing(null);
      fetchHistory();
    } catch (err) {
      toast.error(apiErrorDetail(err) || "Failed to update announcement");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const r = await api.delete(`/admin/announcements/${deleting.id}`);
      const removing: number = r.data?.removing_count ?? 0;
      toast.success(removing > 0 ? `Deleted. Removing it from ${removing} chat(s)…` : "Announcement deleted");
      setDeleting(null);
      if (detailsFor?.id === deleting.id) setDetailsFor(null);
      fetchHistory();
    } catch (err) {
      toast.error(apiErrorDetail(err) || "Failed to delete announcement");
    } finally {
      setDeleteBusy(false);
    }
  };

  const canSend = text.trim().length > 0 && targetReady && !!recipients && !previewError;
  const selectedAudience = AUDIENCES.find((a) => a.value === audience);

  // List filtering + pagination (client side; the history endpoint returns everything)
  const q = listSearch.trim().toLowerCase();
  const filtered = history.filter((a) => {
    if (audienceFilter !== "all" && a.audience !== audienceFilter) return false;
    if (statusFilter === "sending" && !isSending(a)) return false;
    if (statusFilter === "completed" && isSending(a)) return false;
    if (statusFilter === "failures" && a.failed_count === 0) return false;
    if (q && !`${a.text} ${audienceLabel(a)} ${a.created_by || ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const sendingCount = history.filter(isSending).length;
  const filtersActive = !!q || audienceFilter !== "all" || statusFilter !== "all";

  // Any filter change jumps back to the first page
  useEffect(() => setPage(1), [listSearch, audienceFilter, statusFilter]);

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchHistory}>
            <RefreshCw className={`mr-2 h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={() => setComposeOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New announcement
          </Button>
        </div>
      </div>

      {/* Composer */}
      <Dialog open={composeOpen} onOpenChange={(open) => !sending && setComposeOpen(open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
            <DialogDescription>
              Use the toolbar for <b>bold</b>, <i>italic</i>, underline, links and more. Line breaks and emoji are kept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <AnnouncementEditor
              value={text}
              onChange={setText}
              maxLength={MAX_LENGTH}
              placeholder="e.g. 🎓 **New: Dual Degree!** Study two departments with one account…"
            />
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Announcement list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            Sent announcements{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({history.length}
              {sendingCount > 0 ? ` · ${sendingCount} sending` : ""})
            </span>
          </CardTitle>
          <CardDescription>
            Counts update every few seconds while messages are waiting. Click a row to read the full message and see who got it.
          </CardDescription>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search message, audience or sender"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>
            <Select value={audienceFilter} onValueChange={(v) => setAudienceFilter(v as typeof audienceFilter)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All audiences</SelectItem>
                {AUDIENCES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failures">Has failures</SelectItem>
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setListSearch("");
                  setAudienceFilter("all");
                  setStatusFilter("all");
                }}
              >
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-6">Message</TableHead>
                <TableHead className="w-44">Audience</TableHead>
                <TableHead className="w-40">Sent</TableHead>
                <TableHead className="w-56">Delivery</TableHead>
                <TableHead className="w-12 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading && history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
                  </TableCell>
                </TableRow>
              ) : pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    {history.length === 0 ? "No announcements sent yet." : "No announcements match these filters."}
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((a) => {
                  const done = a.sent_count + a.failed_count + a.cancelled_count;
                  const notReceived = a.failed_count + a.cancelled_count;
                  return (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => openDetails(a)}>
                      <TableCell className="pl-6 max-w-0">
                        <p className="truncate text-sm font-medium" title={a.text}>
                          <FormattedAnnouncement text={a.text.split("\n").find((l) => l.trim()) || a.text} />
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {a.version > 1 && (
                            <Badge variant="outline" className="h-4 px-1 text-[10px]">
                              Edited
                            </Badge>
                          )}
                          {a.updating_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Updating {a.updating_count}
                            </span>
                          )}
                          <span>{a.text.length} chars</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="max-w-full truncate font-medium">
                          {audienceLabel(a)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p title={new Date(a.created_at).toLocaleString()}>{timeAgo(a.created_at)}</p>
                        {a.created_by && <p className="truncate text-muted-foreground">by {a.created_by}</p>}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress
                            value={a.recipient_count ? (done / a.recipient_count) * 100 : 100}
                            className="h-1.5"
                          />
                          <div className="flex items-center gap-2.5 text-xs">
                            <span className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400" title="Delivered">
                              <CheckCircle2 className="h-3 w-3" />
                              {a.sent_count}/{a.recipient_count}
                            </span>
                            {a.pending_count > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-700 dark:text-amber-400" title="Waiting">
                                <Clock className="h-3 w-3" />
                                {a.pending_count}
                              </span>
                            )}
                            {notReceived > 0 && (
                              <span className="flex items-center gap-0.5 text-destructive" title="Not received">
                                <AlertTriangle className="h-3 w-3" />
                                {notReceived}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetails(a)}>
                              <ListChecks className="mr-2 h-4 w-4" /> View & recipients
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(a)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            {a.pending_count > 0 && (
                              <DropdownMenuItem onClick={() => handleCancel(a)} className="text-destructive">
                                <Ban className="mr-2 h-4 w-4" /> Stop sending
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleting(a)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-3">
              <span className="text-xs text-muted-foreground">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details dialog: full message, then who got it, who is waiting and why, who failed and why */}
      <Dialog open={!!detailsFor} onOpenChange={(open) => !open && setDetailsFor(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" /> Announcement
              {detailsFor && detailsFor.version > 1 && (
                <Badge variant="outline" className="text-[10px]">
                  Edited
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailsFor
                ? `${audienceLabel(detailsFor)} · sent ${new Date(detailsFor.created_at).toLocaleString()}${
                    detailsFor.created_by ? ` by ${detailsFor.created_by}` : ""
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {detailsFor && (
            <div className="rounded-lg border-l-4 border-primary bg-muted/40 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto shrink-0">
              <FormattedAnnouncement text={detailsFor.text} />
            </div>
          )}
          {detailsFor && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Button size="sm" variant="outline" className="h-8" onClick={() => openEdit(detailsFor)}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
              {detailsFor.pending_count > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-destructive"
                  onClick={() => handleCancel(detailsFor)}
                >
                  <Ban className="mr-1 h-3.5 w-3.5" /> Stop sending
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => setDeleting(detailsFor)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
              {detailsFor.updating_count > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Updating {detailsFor.updating_count} chat
                  {detailsFor.updating_count === 1 ? "" : "s"}…
                </span>
              )}
            </div>
          )}
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

      {/* Edit: waiting users get the new text, delivered copies are edited in their chats */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && !savingEdit && setEditing(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit announcement</DialogTitle>
            <DialogDescription>
              {editing && editing.sent_count - editing.untracked_count > 0
                ? `The ${editing.sent_count - editing.untracked_count} delivered message(s) are edited in users' chats (Telegram marks them "edited"). `
                : ""}
              {editing && editing.pending_count > 0 ? `${editing.pending_count} waiting user(s) get the new text. ` : ""}
              {editing && editing.untracked_count > 0
                ? `${editing.untracked_count} copy(ies) were sent before editing was available and stay as they are.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <AnnouncementEditor value={editText} onChange={setEditText} maxLength={MAX_LENGTH} rows={8} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit || !editText.trim() || editText.trim() === editing?.text}
            >
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete: stop sending, remove from history and from users' chats */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete announcement?</DialogTitle>
            <DialogDescription>
              It stops sending, disappears from this list, and the bot removes it from users' chats. Telegram only
              lets a bot delete messages less than 48 hours old; older copies are replaced with "This announcement
              was withdrawn."
              {deleting && deleting.untracked_count > 0
                ? ` ${deleting.untracked_count} copy(ies) were sent before deleting was available and stay in those chats.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {deleting && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
              <FormattedAnnouncement text={deleting.text} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteBusy}>
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete for everyone
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
              ). You can edit or delete it afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
            <p className="font-semibold mb-2">📢 Announcement</p>
            <FormattedAnnouncement text={text.trim()} />
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
