import { useState } from "react";
import { Check, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, g12Api } from "../api";
import { Empty, Loading, PageHeader, StatusBadge, run, useLoad, when } from "../components/kit";

interface Payment {
  id: string;
  telegram_id: number;
  first_name: string | null;
  username: string | null;
  amount: string;
  currency: string;
  reference: string;
  bank_name: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  receipt_url?: string | null;
}

interface Bank {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  is_active: boolean;
  sort: number;
}

const REJECT_REASONS = [
  "This is not a payment receipt",
  "The amount paid is incorrect",
  "The screenshot is unclear or cropped",
  "Payment was sent to the wrong account",
  "This receipt was already used",
];

const student = (p: Payment) => p.first_name || (p.username ? `@${p.username}` : String(p.telegram_id));

function ReviewDialog({ payment, onClose, onDone }: { payment: Payment; onClose: () => void; onDone: () => void }) {
  const { data, loading } = useLoad(async () => (await g12Api.get<Payment>(`/payments/${payment.id}`)).data, [payment.id]);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const pending = payment.status === "pending";

  const approve = async () => {
    const body = until ? { pro_until: new Date(`${until}T23:59:59`).toISOString() } : {};
    if (await run(() => g12Api.post(`/payments/${payment.id}/approve`, body), "Approved. The student is now PRO.")) onDone();
  };
  const reject = async () => {
    if (await run(() => g12Api.post(`/payments/${payment.id}/reject`, { reason }), "Rejected. The student was told why.")) onDone();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Payment from {student(payment)}</DialogTitle></DialogHeader>
        {loading || !data ? <Loading /> : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Amount</span><span>{data.amount} {data.currency}</span>
              <span className="text-muted-foreground">Bank</span><span>{data.bank_name ?? "—"}</span>
              <span className="text-muted-foreground">Reference</span><span className="font-mono">{data.reference}</span>
              <span className="text-muted-foreground">Telegram ID</span><span>{data.telegram_id}</span>
              <span className="text-muted-foreground">Sent</span><span>{when(data.created_at)}</span>
              <span className="text-muted-foreground">Status</span><span><StatusBadge value={data.status} /></span>
            </div>
            {data.receipt_url ? (
              <a href={data.receipt_url} target="_blank" rel="noreferrer" className="block">
                <img src={data.receipt_url} alt="Receipt" className="max-h-80 w-full object-contain rounded border" />
                <span className="text-xs text-primary inline-flex items-center gap-1 mt-1">Open full size <ExternalLink className="h-3 w-3" /></span>
              </a>
            ) : <p className="text-muted-foreground">Receipt picture is not available.</p>}
            {pending && (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1">
                  <Label>PRO until (optional)</Label>
                  <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Leave empty to use the PRO period from Settings.</p>
                </div>
                <div className="space-y-2">
                  <Label>Reason (needed to reject; the student sees it)</Label>
                  <div className="flex flex-wrap gap-2">
                    {REJECT_REASONS.map((r) => (
                      <Button key={r} type="button" size="sm" variant={reason === r ? "default" : "outline"} onClick={() => setReason(r)}>{r}</Button>
                    ))}
                  </div>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Choose one above or type your own" />
                </div>
              </div>
            )}
            {data.rejection_reason && <p className="text-destructive">Rejected: {data.rejection_reason}</p>}
          </div>
        )}
        {pending && (
          <DialogFooter className="gap-2">
            <Button variant="destructive" disabled={reason.trim().length < 3} onClick={reject}><X className="h-4 w-4 mr-1" />Reject</Button>
            <Button onClick={approve}><Check className="h-4 w-4 mr-1" />Approve</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_BANK = { bank_name: "", account_name: "", account_number: "" };

function BankAccounts() {
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<Bank[]>("/bank-accounts")).data);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_BANK);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [removing, setRemoving] = useState<Bank | null>(null);

  const add = async () => {
    if (await run(() => g12Api.post("/bank-accounts", form), "Bank account added. Students see it on the Upgrade screen.")) {
      setForm(EMPTY_BANK);
      setAdding(false);
      reload();
    }
  };
  const save = async () => {
    if (!editing) return;
    const { bank_name, account_name, account_number, sort } = editing;
    if (await run(() => g12Api.patch(`/bank-accounts/${editing.id}`, { bank_name, account_name, account_number, sort }),
      "Bank account saved.")) {
      setEditing(null);
      reload();
    }
  };
  const toggle = async (bank: Bank) => {
    if (await run(() => g12Api.patch(`/bank-accounts/${bank.id}`, { is_active: !bank.is_active }),
      bank.is_active ? "Hidden from students." : "Shown to students.")) reload();
  };
  const remove = async () => {
    if (!removing) return;
    try {
      const { data: result } = await g12Api.delete<{ deleted: boolean }>(`/bank-accounts/${removing.id}`);
      toast.success(result.deleted ? "Bank account deleted." : "This account has payments, so it was hidden instead of deleted.");
      setRemoving(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const field = (key: keyof typeof EMPTY_BANK, label: string, placeholder: string) => (
    <div className="space-y-1"><Label>{label}</Label>
      <Input placeholder={placeholder} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>
  );

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Bank accounts shown on the Upgrade screen</CardTitle>
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Add bank account</Button>
      </CardHeader>
      <CardContent>
        {loading && !data ? <Loading /> : !data?.length ? <Empty text="No bank accounts yet. Students cannot pay until you add one." /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Bank</TableHead><TableHead>Account name</TableHead><TableHead>Number</TableHead>
              <TableHead>Order</TableHead><TableHead>Shown</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {data.map((bank) => editing?.id === bank.id ? (
                <TableRow key={bank.id}>
                  <TableCell><Input value={editing.bank_name} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} /></TableCell>
                  <TableCell><Input value={editing.account_name} onChange={(e) => setEditing({ ...editing, account_name: e.target.value })} /></TableCell>
                  <TableCell><Input value={editing.account_number} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" className="w-20" value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) })} /></TableCell>
                  <TableCell />
                  <TableCell className="space-x-2 whitespace-nowrap"><Button size="sm" onClick={save}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></TableCell>
                </TableRow>
              ) : (
                <TableRow key={bank.id}>
                  <TableCell className="font-medium">{bank.bank_name}</TableCell>
                  <TableCell>{bank.account_name}</TableCell>
                  <TableCell className="font-mono">{bank.account_number}</TableCell>
                  <TableCell>{bank.sort}</TableCell>
                  <TableCell><Switch checked={bank.is_active} onCheckedChange={() => toggle(bank)} /></TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => setEditing(bank)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoving(bank)}>
                      <Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add bank account</DialogTitle>
            <DialogDescription>Students see this account on the Upgrade to PRO screen.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {field("bank_name", "Bank", "CBE")}
            {field("account_name", "Account holder name", "Full name on the account")}
            {field("account_number", "Account number", "1000…")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button disabled={!form.bank_name || !form.account_name || !form.account_number} onClick={add}>Add account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delete {removing?.bank_name} account?</DialogTitle>
            <DialogDescription>
              {removing?.account_name} · {removing?.account_number}. Students will no longer see it.
              If payments already used this account, it is hidden instead of deleted.
            </DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" onClick={remove}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function G12PaymentsPage() {
  const [status, setStatus] = useState("pending");
  const [open, setOpen] = useState<Payment | null>(null);
  const { data, loading, reload } = useLoad(async () =>
    (await g12Api.get<{ items: Payment[] }>("/payments", { params: { status, limit: 100 } })).data.items, [status]);

  return (
    <>
      <PageHeader title="Payments" description="Check receipts, approve PRO, and manage the bank accounts students pay to." />
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList><TabsTrigger value="pending">Pending</TabsTrigger><TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger></TabsList>
      </Tabs>
      <Card className="mt-4">
        <CardContent className="p-0">
          {loading ? <Loading /> : !data?.length ? <Empty text={`No ${status} payments.`} /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Amount</TableHead><TableHead>Bank</TableHead>
                <TableHead>Reference</TableHead><TableHead>Sent</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{student(p)}</TableCell>
                    <TableCell>{p.amount} {p.currency}</TableCell>
                    <TableCell>{p.bank_name ?? "—"}</TableCell>
                    <TableCell className="font-mono">{p.reference}</TableCell>
                    <TableCell>{when(p.created_at)}</TableCell>
                    <TableCell><StatusBadge value={p.status} /></TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => setOpen(p)}>{p.status === "pending" ? "Review" : "View"}</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <BankAccounts />
      {open && <ReviewDialog payment={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />}
    </>
  );
}
