import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, Ban, CheckCircle, Loader2, Unlock, Lock, Filter } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  is_pro: boolean;
  is_full_access: boolean;
  is_banned: boolean;
  invite_count: number;
  invited_by_user_id: string | null;
}

const LIMIT = 10;

export default function UsersPage() {
  const { hasPermission, isSuperAdmin } = useAuth();
  const canBan = hasPermission("ban_user");
  const isSuperadmin = isSuperAdmin;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isProFilter, setIsProFilter] = useState<string>("all");
  const [isBannedFilter, setIsBannedFilter] = useState<string>("all");
  const [invitedByFilter, setInvitedByFilter] = useState<string>("");
  
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const [banDialog, setBanDialog] = useState<{ open: boolean; user: User | null; reason: string }>({
    open: false, user: null, reason: "",
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params: any = { 
      limit: LIMIT, 
      offset,
      search: search.trim() || undefined,
    };

    if (isProFilter !== "all") params.is_pro = isProFilter === "pro";
    if (isBannedFilter !== "all") params.is_banned = isBannedFilter === "banned";
    if (invitedByFilter.trim()) params.invited_by = invitedByFilter.trim();

    api
      .get("/admin/users/", { params })
      .then((r) => {
        const data = Array.isArray(r.data) ? (r.data as User[]) : [];
        setUsers(data);
        // Manual pagination total estimation
        setTotal(offset + data.length + (data.length === LIMIT ? LIMIT : 0));
      })
      .catch(() => {
        toast.error("Failed to fetch users from backend");
      })
      .finally(() => setLoading(false));
  }, [offset, search, isProFilter, isBannedFilter, invitedByFilter]);

  useEffect(() => { 
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchUsers]);

  const handleBan = async () => {
    if (!banDialog.user) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/users/${banDialog.user.id}/ban`, undefined, {
        params: { reason: banDialog.reason.trim() || "Banned by admin" },
      });
      toast.success(`User has been banned`);
      setBanDialog({ open: false, user: null, reason: "" });
      fetchUsers();
    } catch {
      toast.error("Failed to ban user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async (user: User) => {
    try {
      await api.post(`/admin/users/${user.id}/unban`);
      toast.success(`User has been unbanned`);
      fetchUsers();
    } catch {
      toast.error("Failed to unban user");
    }
  };

  const handleGrantFullAccess = async (telegram_id: number) => {
    try {
      await api.post("/admin/users/grant-full-access", { telegram_id });
      toast.success("Full access granted! User can now bypass invites.");
      fetchUsers();
    } catch {
      toast.error("Failed to grant full access");
    }
  };

  const handleRevokeFullAccess = async (telegram_id: number) => {
    try {
      await api.post("/admin/users/revoke-full-access", { telegram_id });
      toast.success("Full access revoked. User must now use invites again.");
      fetchUsers();
    } catch {
      toast.error("Failed to revoke full access");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold italic tracking-tight">SYSTEM OVERRIDE: USERS</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest">Master Control Interface</p>
        </div>
        <div className="flex gap-2">
            <Badge variant="outline" className="h-6">TOTAL: {total}</Badge>
            {isSuperadmin && <Badge className="h-6 bg-red-600">SUPERADMIN ACCESS</Badge>}
        </div>
      </div>

      <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-pulse" />
              <Input
                placeholder="Search ID, Username, or Name..."
                className="pl-9 bg-background/50 border-primary/20 focus-visible:ring-primary"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={isProFilter} onValueChange={(v) => { setIsProFilter(v); setOffset(0); }}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Pro Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="pro">Pro Only</SelectItem>
                  <SelectItem value="free">Free Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={isBannedFilter} onValueChange={(v) => { setIsBannedFilter(v); setOffset(0); }}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Moderation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everywhere</SelectItem>
                  <SelectItem value="banned">Banned Only</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                </SelectContent>
              </Select>

              {invitedByFilter && (
                <Button variant="outline" size="sm" onClick={() => setInvitedByFilter("")} className="h-9 border-dashed">
                    Clear Referrer Filter
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-24">Telegram ID</TableHead>
                <TableHead>User Identification</TableHead>
                <TableHead>Access Status</TableHead>
                <TableHead className="text-right">Metrics</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-xs font-mono animate-pulse">SYNCHRONIZING WITH BACKEND...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                    Zero records found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-primary/5 transition-colors group">
                    <TableCell className="font-mono text-sm font-bold text-primary/80">
                      {user.telegram_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold flex items-center gap-1">
                             {user.first_name} {user.last_name}
                             {user.is_full_access && (
                               <span title="Full Platform Access Granted">
                                 <Unlock className="h-4 w-4 text-green-500 inline ml-1" />
                               </span>
                             )}
                        </span>
                        <span className="text-xs text-muted-foreground">@{user.telegram_username || "no_username"}</span>
                        {user.invited_by_user_id && (
                             <button 
                                onClick={() => setInvitedByFilter(user.invited_by_user_id!)}
                                className="text-[10px] text-blue-500 hover:underline text-left mt-1"
                             >
                                Referred by: {user.invited_by_user_id.slice(0,8)}...
                             </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={user.is_pro ? "default" : "outline"} className={user.is_pro ? "bg-amber-500 hover:bg-amber-600 border-none" : ""}>
                            {user.is_pro ? "PRO" : "STANDARD"}
                        </Badge>
                        {user.is_full_access && (
                            <Badge className="bg-green-600 hover:bg-green-700 border-none">UNLIMITED</Badge>
                        )}
                        {user.is_banned && (
                            <Badge variant="destructive">RESTRICTED</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex flex-col items-end">
                            <span className="text-lg font-mono font-bold">{user.invite_count}</span>
                            <span className="text-[10px] uppercase text-muted-foreground">Invites</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isSuperadmin && (
                          user.is_full_access ? (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 border-amber-500 text-amber-600 hover:bg-amber-50"
                                onClick={() => handleRevokeFullAccess(user.telegram_id)}
                            >
                                <Lock className="h-3.5 w-3.5 mr-1" /> Revoke
                            </Button>
                          ) : (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 border-green-500 text-green-600 hover:bg-green-50"
                                onClick={() => handleGrantFullAccess(user.telegram_id)}
                            >
                                <Unlock className="h-3.5 w-3.5 mr-1" /> Access
                            </Button>
                          )
                        )}
                        {canBan && (
                             user.is_banned ? (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 border-green-600 text-green-600 hover:bg-green-50" 
                                  onClick={() => handleUnban(user)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Unban
                                </Button>
                              ) : (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => setBanDialog({ open: true, user, reason: "" })}
                                >
                                  <Ban className="h-3.5 w-3.5 mr-1" /> Ban
                                </Button>
                              )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Sequence {currentPage} of {totalPages || 1} — [{total} Profiles]
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => { setOffset((o) => Math.max(0, o - LIMIT)); window.scrollTo(0,0); }} className="h-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={users.length < LIMIT} onClick={() => { setOffset((o) => o + LIMIT); window.scrollTo(0,0); }} className="h-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ban Dialog */}
      <Dialog open={banDialog.open} onOpenChange={(open) => !open && setBanDialog({ open: false, user: null, reason: "" })}>
        <DialogContent className="border-2 border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
                <Ban className="h-5 w-5" />
                RESTRICT ACCESS
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to terminate access for <strong>{banDialog.user?.telegram_username ?? banDialog.user?.telegram_id}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Investigation/Reason Notes</Label>
            <Textarea
              placeholder="Provide justification for security logs..."
              className="resize-none"
              value={banDialog.reason}
              onChange={(e) => setBanDialog((s) => ({ ...s, reason: e.target.value }))}
            />
          </div>
          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-4">
            <Button variant="ghost" className="h-9" onClick={() => setBanDialog({ open: false, user: null, reason: "" })}>Abort</Button>
            <Button variant="destructive" className="h-9" onClick={handleBan} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              EXECUTE BAN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
