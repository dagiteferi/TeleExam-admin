import React, { useState, useEffect } from "react";
import { CreditCard, Landmark, CheckCircle, XCircle, Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  created_at: string;
}

export default function PaymentsPage() {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const handleApprove = async (id: string) => {
    try {
      await axios.post(`${API_BASE}/admin/payments/requests/${id}/approve`, {}, authHeaders);
      toast.success("Payment request approved! User upgraded to PRO.");
      fetchRequests();
    } catch (err) {
      toast.error("Failed to approve payment request");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await axios.post(`${API_BASE}/admin/payments/requests/${id}/reject`, {}, authHeaders);
      toast.success("Payment request rejected.");
      fetchRequests();
    } catch (err) {
      toast.error("Failed to reject payment request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Bank Management</h1>
          <p className="text-muted-foreground">Manage bank accounts displayed to users and verify PRO payment requests.</p>
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
                        className="h-48 bg-muted flex items-center justify-center overflow-hidden relative cursor-zoom-in group"
                        onClick={() => setPreviewUrl(req.screenshot_url)}
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
                            🔍 Click to expand
                          </span>
                        </div>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-muted-foreground">User ID: {req.user_id.slice(0, 8)}...</span>
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
                        <p className="text-xs text-muted-foreground">Submitted: {new Date(req.created_at).toLocaleString()}</p>
                        {req.status === "pending" && (
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req.id)}>
                              <CheckCircle className="mr-1 h-4 w-4" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="w-full" onClick={() => handleReject(req.id)}>
                              <XCircle className="mr-1 h-4 w-4" /> Reject
                            </Button>
                          </div>
                        )}
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
