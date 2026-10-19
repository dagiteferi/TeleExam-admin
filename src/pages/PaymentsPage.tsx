import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Landmark,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  GraduationCap,
  Copy,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import axios from "axios";
import { getToken } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  is_active: boolean;
}

interface PaymentRequest {
  id: string;
  user_id: string;
  screenshot_url: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  kind: "pro" | "dual_department";
  target_department_name: string | null;
  amount_birr: number | null;
  created_at: string;
}

// Subset of GET /admin/users/{user_id} used to describe the receipt sender
interface SenderInfo {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  department_name: string | null;
  department_code: string | null;
  secondary_department_name: string | null;
  secondary_department_unlocked: boolean;
  is_pro: boolean;
  is_full_access: boolean;
  is_banned: boolean;
  invite_count: number;
  invited_by_username: string | null;
  invited_by_name: string | null;
  total_exams_taken: number;
  average_score: number | null;
  created_at: string;
}

type SenderState = SenderInfo | "loading" | "error";

const REJECT_REASON_PRESETS = [
  "This is not a payment receipt",
  "The amount paid is incorrect",
  "The screenshot is unclear or cropped",
  "Payment was sent to the wrong account",
  "This receipt was already used",
];

const isDual = (req: PaymentRequest) => req.kind === "dual_department";

function paymentLabel(req: PaymentRequest): string {
  if (!isDual(req)) return "PRO Upgrade";
  return req.target_department_name ? `Dual Degree · ${req.target_department_name}` : "Dual Degree";
}

function PaymentKindBadge({ request }: { request: PaymentRequest }) {
  return (
    <Badge
      variant="outline"
      className={
        isDual(request)
          ? "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      }
    >
      {isDual(request) ? "🎓 " : "⭐ "}
      {paymentLabel(request)}
      {request.amount_birr ? ` · ${request.amount_birr} Birr` : ""}
    </Badge>
  );
}

function senderName(sender: SenderInfo): string {
  const name = `${sender.first_name || ""} ${sender.last_name || ""}`.trim();
  return name || (sender.telegram_username ? `@${sender.telegram_username}` : String(sender.telegram_id));
}

export default function PaymentsPage() {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [senders, setSenders] = useState<Record<string, SenderState>>({});
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [confirmDecision, setConfirmDecision] = useState<{ request: PaymentRequest; action: "approve" | "reject" } | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Add Bank State
  const [openAddBank, setOpenAddBank] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // Edit Bank State
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [editBankName, setEditBankName] = useState("");
  const [editAccountName, setEditAccountName] = useState("");
  const [editAccountNumber, setEditAccountNumber] = useState("");

  const token = getToken();

  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const fetchBanks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/payments/banks`, authHeaders);
      setBanks(res.data);
    } catch (err) {
      console.error("Failed to fetch banks", err);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/payments/requests`, authHeaders);
      setRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch requests", err);
    }
  };

  useEffect(() => {
    fetchBanks();
    fetchRequests();
  }, []);

  useEffect(() => {
    setRejectReason("");
  }, [confirmDecision]);

  // Load each receipt sender's profile once from the existing user detail endpoint
  useEffect(() => {
    const missing = [...new Set(requests.map((r) => r.user_id))].filter(
      (id) => !senders[id] || senders[id] === "error"
    );
    if (missing.length === 0) return;
    setSenders((prev) => ({ ...prev, ...Object.fromEntries(missing.map((id) => [id, "loading" as const])) }));
    missing.forEach(async (id) => {
      try {
        const res = await axios.get(`${API_BASE}/admin/users/${id}`, authHeaders);
        setSenders((prev) => ({ ...prev, [id]: res.data as SenderInfo }));
      } catch {
        setSenders((prev) => ({ ...prev, [id]: "error" }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests]);

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_BASE}/admin/payments/banks`,
        {
          bank_name: bankName,
          account_name: accountName,
          account_number: accountNumber,
          is_active: true
        },
        authHeaders
      );
      toast.success("Bank account added successfully!");
      setOpenAddBank(false);
      setBankName("");
      setAccountName("");
      setAccountNumber("");
      fetchBanks();
    } catch (err) {
      toast.error("Failed to add bank account");
    }
  };

  const handleStartEdit = (bank: BankAccount) => {
    setEditingBank(bank);
    setEditBankName(bank.bank_name);
    setEditAccountName(bank.account_name);
    setEditAccountNumber(bank.account_number);
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank) return;
    try {
      await axios.put(
        `${API_BASE}/admin/payments/banks/${editingBank.id}`,
        {
          bank_name: editBankName,
          account_name: editAccountName,
          account_number: editAccountNumber,
        },
        authHeaders
      );
      toast.success("Bank account updated!");
      setEditingBank(null);
      fetchBanks();
    } catch (err) {
      toast.error("Failed to update bank account");
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bank account?")) return;
    try {
      await axios.delete(`${API_BASE}/admin/payments/banks/${id}`, authHeaders);
      toast.success("Bank account deleted.");
      fetchBanks();
    } catch (err) {
      toast.error("Failed to delete bank account");
    }
  };

  const handleToggleBankActive = async (bank: BankAccount) => {
    try {
      await axios.put(
        `${API_BASE}/admin/payments/banks/${bank.id}`,
        { is_active: !bank.is_active },
        authHeaders
      );
      toast.success(`Bank account ${!bank.is_active ? "activated" : "deactivated"}`);
      fetchBanks();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDecision = async () => {
    if (!confirmDecision) return;
    const { request, action } = confirmDecision;
    setDecisionLoading(true);
    try {
      const reason = rejectReason.trim();
      await axios.post(`${API_BASE}/admin/payments/requests/${request.id}/${action}`, {}, {
        ...authHeaders,
        params: action === "reject" && reason ? { reason } : undefined,
      });
      toast.success(
        action === "reject"
          ? "Payment request rejected."
          : isDual(request)
          ? "Dual Degree payment approved! Second department unlocked."
          : "Payment request approved! User upgraded to PRO."
      );
      setConfirmDecision(null);
      setSelectedRequest(null);
      // Sender's tier may have changed — refetch their profile too
      setSenders((prev) => {
        const next = { ...prev };
        delete next[request.user_id];
        return next;
      });
      fetchRequests();
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
      toast.error(
        typeof detail === "string"
          ? detail
          : action === "approve"
          ? "Failed to approve payment request"
          : "Failed to reject payment request"
      );
    } finally {
      setDecisionLoading(false);
    }
  };

  const renderSenderSummary = (userId: string) => {
    const sender = senders[userId];
    if (!sender || sender === "loading") {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading sender...
        </div>
      );
    }
    if (sender === "error") {
      return <span className="text-xs font-mono text-muted-foreground">User ID: {userId.slice(0, 8)}... (details unavailable)</span>;
    }
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm">{senderName(sender)}</span>
          {sender.is_pro && <Badge className="bg-amber-500 text-white text-[10px]">PRO</Badge>}
          {sender.secondary_department_name && sender.secondary_department_unlocked && (sender.is_pro || sender.is_full_access) && (
            <Badge className="bg-violet-600 text-white text-[10px]">DUAL</Badge>
          )}
          {sender.is_banned && <Badge variant="destructive" className="text-[10px]">BANNED</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {sender.telegram_username ? `@${sender.telegram_username}` : "no username"} · ID{" "}
          <span className="font-mono">{sender.telegram_id}</span>
        </p>
        <p className="text-xs flex items-center gap-1">
          <GraduationCap className="h-3.5 w-3.5 text-primary" />
          {sender.department_name || <span className="italic text-muted-foreground">No department</span>}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Bank Management</h1>
          <p className="text-muted-foreground">Manage bank accounts displayed to users and verify PRO and Dual Degree payment requests.</p>
        </div>
        <Button onClick={() => { fetchBanks(); fetchRequests(); }} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Payment Requests
          </TabsTrigger>
          <TabsTrigger value="banks" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Bank Accounts
          </TabsTrigger>
        </TabsList>

        {/* PAYMENT REQUESTS TAB */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Payment Requests</CardTitle>
              <CardDescription>Review uploaded transaction screenshots and approve PRO access.</CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment requests submitted yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {requests.map((req) => (
                    <Card key={req.id} className="overflow-hidden border">
                      <div
                        className="h-48 bg-muted flex items-center justify-center overflow-hidden relative cursor-pointer group"
                        onClick={() => setSelectedRequest(req)}
                      >
                        <img
                          src={req.screenshot_url}
                          alt="Receipt Screenshot"
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                            🔍 View details
                          </span>
                        </div>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          {renderSenderSummary(req.user_id)}
                          <Badge
                            variant={
                              req.status === "approved"
                                ? "default"
                                : req.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {req.status}
                          </Badge>
                        </div>
                        <PaymentKindBadge request={req} />
                        <p className="text-xs text-muted-foreground">Submitted: {new Date(req.created_at).toLocaleString()}</p>
                        {req.status === "rejected" && req.rejection_reason && (
                          <p className="text-xs rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 line-clamp-2">
                            <span className="font-semibold text-destructive">Reason:</span> {req.rejection_reason}
                          </p>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" className="w-full" onClick={() => setSelectedRequest(req)}>
                            Details
                          </Button>
                          {req.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="w-full bg-green-600 hover:bg-green-700"
                                onClick={() => setConfirmDecision({ request: req, action: "approve" })}
                              >
                                <CheckCircle className="mr-1 h-4 w-4" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="w-full"
                                onClick={() => setConfirmDecision({ request: req, action: "reject" })}
                              >
                                <XCircle className="mr-1 h-4 w-4" /> Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BANK ACCOUNTS TAB */}
        <TabsContent value="banks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Configured Bank Accounts</CardTitle>
                <CardDescription>Accounts displayed in the Telegram Bot when users click Upgrade to PRO.</CardDescription>
              </div>
              <Dialog open={openAddBank} onOpenChange={setOpenAddBank}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Bank Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Bank Account</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateBank} className="space-y-4 pt-2">
                    <div>
                      <Label htmlFor="bankName">Bank / Provider Name</Label>
                      <Input
                        id="bankName"
                        placeholder="e.g. Commercial Bank of Ethiopia"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="accountName">Account Holder Name</Label>
                      <Input
                        id="accountName"
                        placeholder="e.g. TeleExam AI"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="accountNumber">Account / Phone Number</Label>
                      <Input
                        id="accountNumber"
                        placeholder="e.g. 1000123456789"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full">Save Bank Account</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {banks.map((bank) => (
                  <Card key={bank.id} className="border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{bank.bank_name}</h3>
                      <Badge variant={bank.is_active ? "default" : "outline"}>
                        {bank.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm"><strong>Account Name:</strong> {bank.account_name}</p>
                    <p className="text-sm font-mono"><strong>Number:</strong> {bank.account_number}</p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button
                        size="sm"
                        variant={bank.is_active ? "outline" : "default"}
                        onClick={() => handleToggleBankActive(bank)}
                      >
                        {bank.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleStartEdit(bank)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteBank(bank.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* EDIT BANK DIALOG */}
      <Dialog open={!!editingBank} onOpenChange={(open) => { if (!open) setEditingBank(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bank Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateBank} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="editBankName">Bank / Provider Name</Label>
              <Input
                id="editBankName"
                value={editBankName}
                onChange={(e) => setEditBankName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="editAccountName">Account Holder Name</Label>
              <Input
                id="editAccountName"
                value={editAccountName}
                onChange={(e) => setEditAccountName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="editAccountNumber">Account / Phone Number</Label>
              <Input
                id="editAccountNumber"
                value={editAccountNumber}
                onChange={(e) => setEditAccountNumber(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">Update Bank Account</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* RECEIPT DETAIL DIALOG */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              Payment Receipt
              {selectedRequest && <PaymentKindBadge request={selectedRequest} />}
              {selectedRequest && (
                <Badge
                  variant={
                    selectedRequest.status === "approved"
                      ? "default"
                      : selectedRequest.status === "rejected"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {selectedRequest.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Submitted {selectedRequest ? new Date(selectedRequest.created_at).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (() => {
            const sender = senders[selectedRequest.user_id];
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Receipt image */}
                <div
                  className="relative bg-muted rounded-lg overflow-hidden cursor-zoom-in group min-h-[240px] flex items-center justify-center"
                  onClick={() => setPreviewUrl(selectedRequest.screenshot_url)}
                >
                  <img
                    src={selectedRequest.screenshot_url}
                    alt="Receipt Screenshot"
                    className="max-h-[60vh] w-full object-contain"
                  />
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <ZoomIn className="h-3 w-3" /> Full size
                  </span>
                </div>

                {/* Sender details */}
                <div className="space-y-3 text-sm">
                  {selectedRequest.status === "rejected" && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1">
                      <p className="font-semibold text-destructive flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Rejection reason
                      </p>
                      <p className="whitespace-pre-wrap">
                        {selectedRequest.rejection_reason || (
                          <span className="italic text-muted-foreground">No reason given</span>
                        )}
                      </p>
                    </div>
                  )}
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">Payment</h4>
                  <div className="rounded-lg border divide-y text-xs">
                    <DetailRow label="Type">{isDual(selectedRequest) ? "Dual Degree (second department)" : "PRO upgrade"}</DetailRow>
                    <DetailRow label="Expected amount">
                      {selectedRequest.amount_birr ? `${selectedRequest.amount_birr} Birr` : "—"}
                    </DetailRow>
                    {isDual(selectedRequest) && (
                      <DetailRow label="Department to unlock">{selectedRequest.target_department_name || "—"}</DetailRow>
                    )}
                  </div>
                  {isDual(selectedRequest) && sender && typeof sender === "object" && !sender.is_pro && !sender.is_full_access && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                      This user is not PRO yet. A Dual Degree payment cannot be approved until their PRO payment is approved.
                    </p>
                  )}
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">Sender</h4>
                  {!sender || sender === "loading" ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading sender details...
                    </div>
                  ) : sender === "error" ? (
                    <p className="text-muted-foreground">
                      Could not load user details. User ID: <span className="font-mono">{selectedRequest.user_id}</span>
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold">{senderName(sender)}</span>
                        <Badge variant={sender.is_pro ? "default" : "outline"} className={sender.is_pro ? "bg-amber-500" : ""}>
                          {sender.is_pro ? "PRO" : "Free"}
                        </Badge>
                        {sender.is_full_access && <Badge className="bg-green-600 text-white">UNLIMITED</Badge>}
                        {sender.is_banned && <Badge variant="destructive">BANNED</Badge>}
                      </div>
                      <div className="rounded-lg border divide-y text-xs">
                        <DetailRow label="Telegram username">
                          {sender.telegram_username ? (
                            <a
                              href={`https://t.me/${sender.telegram_username}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              @{sender.telegram_username} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </DetailRow>
                        <DetailRow label="Telegram ID">
                          <button
                            className="font-mono inline-flex items-center gap-1 hover:text-primary"
                            onClick={() => {
                              navigator.clipboard.writeText(String(sender.telegram_id));
                              toast.success("Telegram ID copied");
                            }}
                          >
                            {sender.telegram_id} <Copy className="h-3 w-3" />
                          </button>
                        </DetailRow>
                        <DetailRow label="User UUID">
                          <span className="font-mono text-[10px]">{sender.id}</span>
                        </DetailRow>
                        <DetailRow label="Department">
                          {sender.department_name
                            ? `${sender.department_name}${sender.department_code ? ` (${sender.department_code})` : ""}`
                            : "Not selected"}
                        </DetailRow>
                        {sender.secondary_department_name && (
                          <DetailRow label="Second department">
                            {sender.secondary_department_name}
                            {sender.secondary_department_unlocked ? " (unlocked)" : " (locked)"}
                          </DetailRow>
                        )}
                        <DetailRow label="Joined">{new Date(sender.created_at).toLocaleString()}</DetailRow>
                        <DetailRow label="Exams taken">{sender.total_exams_taken}</DetailRow>
                        <DetailRow label="Average score">
                          {sender.average_score !== null ? `${sender.average_score.toFixed(1)}%` : "N/A"}
                        </DetailRow>
                        <DetailRow label="Invites">{sender.invite_count}</DetailRow>
                        <DetailRow label="Referred by">
                          {sender.invited_by_username ? `@${sender.invited_by_username}` : sender.invited_by_name || "—"}
                        </DetailRow>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {selectedRequest?.status === "pending" && (
            <DialogFooter className="border-t pt-4">
              <Button
                variant="destructive"
                onClick={() => setConfirmDecision({ request: selectedRequest, action: "reject" })}
              >
                <XCircle className="mr-1 h-4 w-4" /> Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setConfirmDecision({ request: selectedRequest, action: "approve" })}
              >
                <CheckCircle className="mr-1 h-4 w-4" /> Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* APPROVE / REJECT CONFIRMATION */}
      <Dialog open={!!confirmDecision} onOpenChange={(open) => { if (!open && !decisionLoading) setConfirmDecision(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${confirmDecision?.action === "reject" ? "text-destructive" : ""}`}
            >
              <ShieldAlert className="h-5 w-5" />
              {confirmDecision?.action === "approve" ? "Approve Payment" : "Reject Payment"}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const sender = confirmDecision ? senders[confirmDecision.request.user_id] : undefined;
                const who = sender && typeof sender === "object" ? senderName(sender) : "this user";
                const req = confirmDecision?.request;
                const amount = req?.amount_birr ? ` (${req.amount_birr} Birr)` : "";
                if (confirmDecision?.action !== "approve") {
                  return `Reject the ${req ? paymentLabel(req) : ""} payment${amount} from ${who}? They will be notified via Telegram that the receipt could not be verified.`;
                }
                return req && isDual(req)
                  ? `Approve the Dual Degree payment${amount} from ${who}? Their second department${req.target_department_name ? ` (${req.target_department_name})` : ""} will be unlocked. This does NOT make them PRO.`
                  : `Approve the PRO payment${amount} from ${who}? They will be upgraded to PRO and notified via Telegram.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          {confirmDecision?.action === "reject" && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Reason (sent to the user in the bot)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {REJECT_REASON_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={rejectReason === preset ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setRejectReason(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <Textarea
                placeholder="Explain why the receipt was rejected..."
                className="resize-none"
                maxLength={500}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Optional. If left empty, the user gets the standard rejection message.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDecision(null)} disabled={decisionLoading}>
              Cancel
            </Button>
            <Button
              variant={confirmDecision?.action === "reject" ? "destructive" : "default"}
              className={confirmDecision?.action === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              onClick={handleDecision}
              disabled={decisionLoading}
            >
              {decisionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmDecision?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IMAGE LIGHTBOX */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-0">
          <DialogHeader className="p-2">
            <DialogTitle className="text-white text-sm">Payment Receipt</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Full Receipt"
                className="max-h-[80vh] max-w-full rounded object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-all">{children}</span>
    </div>
  );
}
