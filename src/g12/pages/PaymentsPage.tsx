import { useState } from "react";
import { Check, ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { g12Api } from "../api";
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
                <div className="space-y-1">
                  <Label>Reason (needed to reject)</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The amount on the receipt is wrong" />
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

function BankAccounts() {
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<Bank[]>("/bank-accounts")).data);
  const [form, setForm] = useState({ bank_name: "", account_name: "", account_number: "" });
  const [editing, setEditing] = useState<Bank | null>(null);

  const add = async () => {
    if (await run(() => g12Api.post("/bank-accounts", form), "Bank account added.")) {
      setForm({ bank_name: "", account_name: "", account_number: "" });
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

  return (
    <Card className="mt-6">
      <CardHeader><CardTitle className="text-base">Bank accounts shown on the Upgrade screen</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Loading /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Bank</TableHead><TableHead>Account name</TableHead><TableHead>Number</TableHead>
              <TableHead>Order</TableHead><TableHead>Shown</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((bank) => editing?.id === bank.id ? (
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
                  <TableCell><Button size="sm" variant="outline" onClick={() => setEditing(bank)}>Edit</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] items-end border-t pt-4">
          <div className="space-y-1"><Label>Bank</Label><Input placeholder="CBE" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Account name</Label><Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Account number</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
          <Button disabled={!form.bank_name || !form.account_name || !form.account_number} onClick={add}><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>
      </CardContent>
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
