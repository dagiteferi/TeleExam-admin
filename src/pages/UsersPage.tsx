import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, ChevronLeft, ChevronRight, Ban, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id: string;
  telegram_username: string | null;
  is_pro: boolean;
  is_banned: boolean;
  invite_count: number;
}

const LIMIT = 10;

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const canBan = hasPermission("ban_user");

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const [banDialog, setBanDialog] = useState<{ open: boolean; user: User | null; reason: string }>({
    open: false, user: null, reason: "",
  });
  const [actionLoading, setActionLoading] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.telegram_username ?? "").toLowerCase().includes(q));
  }, [users, search]);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    api
      .get("/admin/users/", { params: { limit: LIMIT, offset } })
      .then((r) => {
        const data = Array.isArray(r.data) ? (r.data as User[]) : [];
        setUsers(data);
        // Backend returns an array (no total). Approximate total for pagination UX.
        setTotal(offset + data.length + (data.length === LIMIT ? LIMIT : 0));
      })
      .catch(() => {
        // Mock data
        const mock: User[] = Array.from({ length: 10 }, (_, i) => ({
          id: crypto.randomUUID(),
          telegram_username: `@user_${offset + i + 1}`,
          is_pro: Math.random() > 0.7,
          is_banned: Math.random() > 0.9,
          invite_count: Math.floor(Math.random() * 50),
        }));
        setUsers(mock);
        setTotal(156);
      })
      .finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleBan = async () => {
    if (!banDialog.user) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/users/${banDialog.user.id}/ban`, undefined, {
        params: { reason: banDialog.reason.trim() || "Banned by admin" },
      });
      toast.success(`User ${banDialog.user.telegram_username ?? banDialog.user.id} has been banned`);
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
      toast.success(`User ${user.telegram_username ?? user.id} has been unbanned`);
      fetchUsers();
    } catch {
      toast.error("Failed to unban user");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users Management</h1>
        <p className="text-muted-foreground text-sm">Manage platform users</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">All Users</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Pro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Invites</TableHead>
                {canBan && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={canBan ? 6 : 5} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canBan ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-xs">{user.id}</TableCell>
                    <TableCell className="font-medium">{user.telegram_username ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_pro ? "default" : "secondary"}>
                        {user.is_pro ? "Pro" : "Free"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_banned ? "destructive" : "secondary"}>
                        {user.is_banned ? "Banned" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{user.invite_count}</TableCell>
                    {canBan && (
                      <TableCell className="text-right">
                        {user.is_banned ? (
                          <Button variant="ghost" size="sm" onClick={() => handleUnban(user)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Unban
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setBanDialog({ open: true, user, reason: "" })}
                          >
                            <Ban className="h-4 w-4 mr-1" /> Ban
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages || 1} ({total} users)
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={offset + LIMIT >= total} onClick={() => setOffset((o) => o + LIMIT)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ban Dialog */}
      <Dialog open={banDialog.open} onOpenChange={(open) => !open && setBanDialog({ open: false, user: null, reason: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Are you sure you want to ban <strong>{banDialog.user?.telegram_username ?? banDialog.user?.id}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              placeholder="Enter reason for ban..."
              value={banDialog.reason}
              onChange={(e) => setBanDialog((s) => ({ ...s, reason: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialog({ open: false, user: null, reason: "" })}>Cancel</Button>
            <Button variant="destructive" onClick={handleBan} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
