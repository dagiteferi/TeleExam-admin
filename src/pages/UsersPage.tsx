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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Ban,
  CheckCircle,
  Loader2,
  Unlock,
  Lock,
  Star,
  StarOff,
  RotateCcw,
  Eye,
  GraduationCap,
  ExternalLink,
  Copy,
  Calendar,
  BookOpen,
  Award,
  Users as UsersIcon,
  Clock,
  ShieldAlert,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  is_pro: boolean;
  is_full_access: boolean;
  is_banned: boolean;
  invite_count: number;
  invited_by_user_id: string | null;
  invited_by_username: string | null;
  invited_by_name: string | null;
  created_at: string;
  updated_at: string;
  plan_expiry: string | null;
  ban_reason: string | null;
  banned_until: string | null;
  exams_count?: number;
  avg_score?: number | null;
}

interface UserExamSummary {
  id: string;
  course_name: string | null;
  mode: string;
  question_count: number;
  correct_count: number;
  wrong_count: number;
  score_percent: number;
  duration_seconds: number;
  submitted_at: string;
}

interface InvitedUserSummary {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  is_pro: boolean;
  is_full_access: boolean;
  created_at: string;
}

interface UserDetail extends User {
  invite_code: string | null;
  total_exams_taken: number;
  average_score: number | null;
  total_questions_answered: number;
  total_correct_answers: number;
  total_wrong_answers: number;
  recent_exams: UserExamSummary[];
  invited_users: InvitedUserSummary[];
}

interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

const LIMIT = 10;

function copyText(text: string, label: string = "Copied") {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard`);
}

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return "N/A";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function UsersPage() {
  const { hasPermission, isSuperAdmin } = useAuth();
  const canBan = hasPermission("ban_user");
  const isSuperadmin = isSuperAdmin;

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [isProFilter, setIsProFilter] = useState<string>("all");
  const [isBannedFilter, setIsBannedFilter] = useState<string>("all");
  const [invitedByFilter, setInvitedByFilter] = useState<string>("");

  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  // Detail Modal State
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Ban Dialog
  const [banDialog, setBanDialog] = useState<{ open: boolean; user: User | null; reason: string }>({
    open: false,
    user: null,
    reason: "",
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Load departments once for the filter
  useEffect(() => {
    api
      .get("/admin/users/departments")
      .then((r) => {
        if (Array.isArray(r.data)) setDepartments(r.data);
      })
      .catch(() => {
        // Fallback to discovery metadata if /admin/users/departments fails
        api.get("/public/discovery-metadata").then((r) => {
          if (r.data?.departments) setDepartments(r.data.departments);
        }).catch(() => {});
      });
  }, []);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params: any = {
      limit: LIMIT,
      offset,
      search: search.trim() || undefined,
    };

    if (departmentFilter !== "all") params.department_id = departmentFilter;
    if (isProFilter !== "all") params.is_pro = isProFilter === "pro";
    if (isBannedFilter !== "all") params.is_banned = isBannedFilter === "banned";
    if (invitedByFilter.trim()) params.invited_by = invitedByFilter.trim();

    api
      .get("/admin/users/", { params })
      .then((r) => {
        const data = Array.isArray(r.data) ? (r.data as User[]) : [];
        setUsers(data);
        setTotal(offset + data.length + (data.length === LIMIT ? LIMIT : 0));
      })
      .catch(() => {
        toast.error("Failed to fetch users from backend");
      })
      .finally(() => setLoading(false));
  }, [offset, search, departmentFilter, isProFilter, isBannedFilter, invitedByFilter]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchUsers]);

  // Load detailed user view
  const handleOpenDetails = async (user: User) => {
    setSelectedUser(user);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/users/${user.id}`);
      setUserDetail(res.data);
    } catch {
      toast.error("Could not load full user details");
      // Fallback: populate basic info from user row
      setUserDetail({
        ...user,
        invite_code: null,
        total_exams_taken: user.exams_count || 0,
        average_score: user.avg_score || null,
        total_questions_answered: 0,
        total_correct_answers: 0,
        total_wrong_answers: 0,
        recent_exams: [],
        invited_users: [],
      });
    } finally {
      setDetailLoading(false);
    }
  };

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
      if (selectedUser?.id === banDialog.user.id) {
        handleOpenDetails(banDialog.user);
      }
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
      if (selectedUser?.id === user.id) {
        handleOpenDetails(user);
      }
    } catch {
      toast.error("Failed to unban user");
    }
  };

  const handleGrantFullAccess = async (telegram_id: number) => {
    try {
      await api.post("/admin/users/grant-full-access", { telegram_id });
      toast.success("Full access granted! User can now bypass invites.");
      fetchUsers();
      if (selectedUser?.telegram_id === telegram_id) {
        handleOpenDetails(selectedUser);
      }
    } catch {
      toast.error("Failed to grant full access");
    }
  };

  const handleRevokeFullAccess = async (telegram_id: number) => {
    try {
      await api.post("/admin/users/revoke-full-access", { telegram_id });
      toast.success("Full access revoked. User must now use invites again.");
      fetchUsers();
      if (selectedUser?.telegram_id === telegram_id) {
        handleOpenDetails(selectedUser);
      }
    } catch {
      toast.error("Failed to revoke full access");
    }
  };

  const handleTogglePro = async (user: User) => {
    const newStatus = !user.is_pro;
    try {
      await api.post(`/admin/users/${user.id}/toggle-pro`, undefined, {
        params: { is_pro: newStatus },
      });
      toast.success(
        newStatus
          ? `✨ ${user.first_name || user.telegram_username || "User"} is now PRO — notified via Telegram`
          : `🔓 ${user.first_name || user.telegram_username || "User"} downgraded to Free — notified via Telegram`
      );
      fetchUsers();
      if (selectedUser?.id === user.id) {
        handleOpenDetails({ ...user, is_pro: newStatus });
      }
    } catch {
      toast.error("Failed to toggle PRO status");
    }
  };

  const handleResetAccess = async (user: User) => {
    if (
      !confirm(
        `Reset ALL access for ${user.first_name || user.telegram_username || user.telegram_id}? This will remove PRO, full access, and reset invites to 0.`
      )
    )
      return;
    try {
      await api.post(`/admin/users/${user.id}/reset-access`);
      toast.success(`⚠️ Access fully reset for ${user.first_name || user.telegram_username || "User"}`);
      fetchUsers();
      if (selectedUser?.id === user.id) {
        handleOpenDetails({ ...user, is_pro: false, is_full_access: false, invite_count: 0 });
      }
    } catch {
      toast.error("Failed to reset user access");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Users</h1>
          <p className="text-muted-foreground text-sm">
            View registered students, departments, academic performance, and moderation controls.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="h-6">TOTAL: {total}</Badge>
          {isSuperadmin && <Badge className="h-6 bg-red-600 text-white">SUPERADMIN ACCESS</Badge>}
        </div>
      </div>

      <Card className="border border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, Username, Name, or Dept..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOffset(0);
                }}
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap gap-2">
              {/* Department Filter */}
              <Select
                value={departmentFilter}
                onValueChange={(v) => {
                  setDepartmentFilter(v);
                  setOffset(0);
                }}
              >
                <SelectTrigger className="w-[170px] h-9">
                  <GraduationCap className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.code ? `(${d.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* PRO Tier Filter */}
              <Select
                value={isProFilter}
                onValueChange={(v) => {
                  setIsProFilter(v);
                  setOffset(0);
                }}
              >
                <SelectTrigger className="w-[125px] h-9">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="pro">PRO Only</SelectItem>
                  <SelectItem value="free">Standard Only</SelectItem>
                </SelectContent>
              </Select>

              {/* Moderation Filter */}
              <Select
                value={isBannedFilter}
                onValueChange={(v) => {
                  setIsBannedFilter(v);
                  setOffset(0);
                }}
              >
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="banned">Banned Only</SelectItem>
                </SelectContent>
              </Select>

              {invitedByFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInvitedByFilter("")}
                  className="h-9 border-dashed text-xs"
                >
                  Clear Referrer
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-28">Telegram ID</TableHead>
                <TableHead>User Identification</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Tier / Status</TableHead>
                <TableHead className="text-right">Referrals</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-xs font-mono text-muted-foreground">LOADING PROFILES...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground italic">
                    No users found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                    {/* Telegram ID */}
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {user.telegram_id}
                    </TableCell>

                    {/* Name & Handle */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm flex items-center gap-1">
                          {user.first_name || user.last_name
                            ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                            : "Unnamed Student"}
                          {user.is_full_access && (
                            <span title="Full Platform Access Granted">
                              <Unlock className="h-3.5 w-3.5 text-green-500 inline ml-1" />
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          @{user.telegram_username || "no_username"}
                        </span>
                        {user.invited_by_username && (
                          <span className="text-[10px] text-blue-500 mt-0.5">
                            Referred by @{user.invited_by_username}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Department */}
                    <TableCell>
                      {user.department_name ? (
                        <Badge
                          variant="secondary"
                          className="font-normal text-xs gap-1 border border-border"
                        >
                          <GraduationCap className="h-3 w-3 text-primary" />
                          {user.department_name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not selected</span>
                      )}
                    </TableCell>

                    {/* Access Tier */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={user.is_pro ? "default" : "outline"}
                          className={
                            user.is_pro
                              ? "bg-amber-500 hover:bg-amber-600 text-white border-none font-semibold text-[10px]"
                              : "text-[10px]"
                          }
                        >
                          {user.is_pro ? "PRO" : "STANDARD"}
                        </Badge>
                        {user.is_full_access && (
                          <Badge className="bg-green-600 text-white border-none text-[10px]">
                            UNLIMITED
                          </Badge>
                        )}
                        {user.is_banned && (
                          <Badge variant="destructive" className="text-[10px]">
                            BANNED
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Referrals Count */}
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-mono font-bold">{user.invite_count}</span>
                        <span className="text-[10px] text-muted-foreground">Invites</span>
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        {/* View Details Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => handleOpenDetails(user)}
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" />
                          Details
                        </Button>

                        {/* Toggle PRO Button */}
                        {user.is_pro ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                            onClick={() => handleTogglePro(user)}
                            title="Revoke PRO"
                          >
                            <StarOff className="h-3 w-3 mr-1" /> Revoke PRO
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                            onClick={() => handleTogglePro(user)}
                            title="Upgrade to PRO"
                          >
                            <Star className="h-3 w-3 mr-1" /> Make PRO
                          </Button>
                        )}

                        {/* Full Access */}
                        {isSuperadmin &&
                          (user.is_full_access ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-amber-500 text-amber-600 hover:bg-amber-50"
                              onClick={() => handleRevokeFullAccess(user.telegram_id)}
                              title="Revoke unlimited access"
                            >
                              <Lock className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-green-500 text-green-600 hover:bg-green-50"
                              onClick={() => handleGrantFullAccess(user.telegram_id)}
                              title="Grant unlimited bypass access"
                            >
                              <Unlock className="h-3 w-3" />
                            </Button>
                          ))}

                        {/* Ban / Unban */}
                        {canBan &&
                          (user.is_banned ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-green-600 text-green-600 hover:bg-green-50"
                              onClick={() => handleUnban(user)}
                              title="Unban user"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => setBanDialog({ open: true, user, reason: "" })}
                              title="Ban user"
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages || 1} — Showing {users.length} of {total} profiles
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => {
                  setOffset((o) => Math.max(0, o - LIMIT));
                  window.scrollTo(0, 0);
                }}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={users.length < LIMIT}
                onClick={() => {
                  setOffset((o) => o + LIMIT);
                  window.scrollTo(0, 0);
                }}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===================================================================== */}
      {/* USER DETAILS MODAL                                                    */}
      {/* ===================================================================== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg border border-primary/20">
                  {selectedUser?.first_name ? selectedUser.first_name[0].toUpperCase() : "U"}
                </div>
                <div>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    {selectedUser?.first_name || selectedUser?.last_name
                      ? `${selectedUser?.first_name || ""} ${selectedUser?.last_name || ""}`.trim()
                      : "Telegram User"}
                    {selectedUser?.is_pro && (
                      <Badge className="bg-amber-500 text-white font-bold text-[10px]">PRO</Badge>
                    )}
                    {selectedUser?.is_full_access && (
                      <Badge className="bg-green-600 text-white font-bold text-[10px]">UNLIMITED</Badge>
                    )}
                    {selectedUser?.is_banned && (
                      <Badge variant="destructive" className="font-bold text-[10px]">BANNED</Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-3 text-xs mt-1">
                    {selectedUser?.telegram_username ? (
                      <a
                        href={`https://t.me/${selectedUser.telegram_username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        @{selectedUser.telegram_username}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No telegram handle</span>
                    )}
                    <span className="text-muted-foreground">•</span>
                    <button
                      onClick={() => copyText(String(selectedUser?.telegram_id), "Telegram ID")}
                      className="font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                      title="Click to copy Telegram ID"
                    >
                      ID: {selectedUser?.telegram_id}
                      <Copy className="h-3 w-3" />
                    </button>
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading full profile details...</p>
            </div>
          ) : userDetail ? (
            <Tabs defaultValue="overview" className="w-full pt-2">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="overview">Overview & Department</TabsTrigger>
                <TabsTrigger value="learning">Exam Performance</TabsTrigger>
                <TabsTrigger value="referrals">Referrals ({userDetail.invite_count})</TabsTrigger>
              </TabsList>

              {/* TAB 1: OVERVIEW & DEPARTMENT */}
              <TabsContent value="overview" className="space-y-4">
                {/* Department Info Banner */}
                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide">Field of Study / Department</p>
                      <h4 className="text-base font-bold text-foreground">
                        {userDetail.department_name || "No department selected"}
                      </h4>
                      {userDetail.department_code && (
                        <p className="text-xs text-muted-foreground">Code: {userDetail.department_code}</p>
                      )}
                    </div>
                  </div>
                  {userDetail.department_name && (
                    <Badge variant="secondary" className="text-xs">
                      Enrolled
                    </Badge>
                  )}
                </div>

                {/* Account Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Registration & Status */}
                  <Card className="border">
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" /> Registration & Account
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Joined At:</span>
                        <span className="font-medium">{formatDate(userDetail.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Activity:</span>
                        <span className="font-medium">{formatDate(userDetail.updated_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Database User UUID:</span>
                        <button
                          onClick={() => copyText(userDetail.id, "User UUID")}
                          className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1"
                        >
                          {userDetail.id.slice(0, 13)}...
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Telegram User ID:</span>
                        <span className="font-mono font-medium">{userDetail.telegram_id}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 2: Subscription & Access */}
                  <Card className="border">
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-primary" /> Subscription & Tier
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">PRO Membership:</span>
                        <Badge variant={userDetail.is_pro ? "default" : "outline"} className={userDetail.is_pro ? "bg-amber-500" : ""}>
                          {userDetail.is_pro ? "Active PRO" : "Standard (Free)"}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Unlimited Access Bypass:</span>
                        <Badge variant={userDetail.is_full_access ? "default" : "outline"} className={userDetail.is_full_access ? "bg-green-600" : ""}>
                          {userDetail.is_full_access ? "Granted" : "Standard Locking"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plan Expiry:</span>
                        <span className="font-medium">
                          {userDetail.plan_expiry ? formatDate(userDetail.plan_expiry) : "Never (Lifetime)"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Moderation Status:</span>
                        <Badge variant={userDetail.is_banned ? "destructive" : "outline"}>
                          {userDetail.is_banned ? "Restricted / Banned" : "Good Standing"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Card 3: Ban Details if banned */}
                {userDetail.is_banned && (
                  <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-destructive">
                      <ShieldAlert className="h-4 w-4" /> Account Currently Restricted
                    </div>
                    <p className="text-muted-foreground">
                      <strong>Reason:</strong> {userDetail.ban_reason || "No reason specified"}
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Banned Until:</strong> {userDetail.banned_until ? formatDate(userDetail.banned_until) : "Permanent"}
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: EXAMS & LEARNING */}
              <TabsContent value="learning" className="space-y-4">
                {/* 4 Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">Exams Taken</span>
                    <p className="text-xl font-bold font-mono text-primary mt-1">{userDetail.total_exams_taken}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">Average Score</span>
                    <p className="text-xl font-bold font-mono text-amber-500 mt-1">
                      {userDetail.average_score !== null ? `${userDetail.average_score.toFixed(1)}%` : "N/A"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">Questions Answered</span>
                    <p className="text-xl font-bold font-mono text-foreground mt-1">
                      {userDetail.total_questions_answered}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">Correct Answers</span>
                    <p className="text-xl font-bold font-mono text-green-600 mt-1">
                      {userDetail.total_correct_answers}
                    </p>
                  </div>
                </div>

                {/* Progress ratio */}
                {userDetail.total_questions_answered > 0 && (
                  <div className="space-y-1.5 p-3 rounded-lg border bg-muted/20">
                    <div className="flex justify-between text-xs">
                      <span>Overall Accuracy</span>
                      <span className="font-bold">
                        {((userDetail.total_correct_answers / userDetail.total_questions_answered) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={(userDetail.total_correct_answers / userDetail.total_questions_answered) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Recent Exam Attempts Table */}
                <Card className="border">
                  <CardHeader className="py-2 px-4 bg-muted/30">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-primary" /> Recent Exam Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="text-xs">
                          <TableHead className="py-2">Course</TableHead>
                          <TableHead className="py-2">Mode</TableHead>
                          <TableHead className="py-2 text-right">Score</TableHead>
                          <TableHead className="py-2 text-right">Correct/Total</TableHead>
                          <TableHead className="py-2 text-right">Duration</TableHead>
                          <TableHead className="py-2 text-right">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userDetail.recent_exams.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground italic">
                              No exam attempts recorded yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          userDetail.recent_exams.map((ex) => (
                            <TableRow key={ex.id} className="text-xs">
                              <TableCell className="font-medium">{ex.course_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {ex.mode}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">
                                <span className={ex.score_percent >= 75 ? "text-green-600" : ex.score_percent >= 50 ? "text-amber-600" : "text-red-600"}>
                                  {ex.score_percent.toFixed(1)}%
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                {ex.correct_count} / {ex.question_count}
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                {formatDuration(ex.duration_seconds)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground text-[10px]">
                                {formatDate(ex.submitted_at)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 3: REFERRALS */}
              <TabsContent value="referrals" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                    <span className="text-muted-foreground">Personal Invite Code:</span>
                    <p className="font-mono font-bold text-foreground">
                      {userDetail.invite_code || "Generated on start"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                    <span className="text-muted-foreground">Referred By:</span>
                    <p className="font-medium text-foreground">
                      {userDetail.invited_by_username
                        ? `@${userDetail.invited_by_username}`
                        : userDetail.invited_by_name || "Organic User (None)"}
                    </p>
                  </div>
                </div>

                {/* Invited Users List */}
                <Card className="border">
                  <CardHeader className="py-2 px-4 bg-muted/30">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <UsersIcon className="h-3.5 w-3.5 text-primary" /> Students Invited By This User ({userDetail.invited_users.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="text-xs">
                          <TableHead className="py-2">Telegram ID</TableHead>
                          <TableHead className="py-2">Name / Handle</TableHead>
                          <TableHead className="py-2">Tier</TableHead>
                          <TableHead className="py-2 text-right">Date Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userDetail.invited_users.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground italic">
                              This student has not invited any peers yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          userDetail.invited_users.map((inv) => (
                            <TableRow key={inv.id} className="text-xs">
                              <TableCell className="font-mono text-primary">{inv.telegram_id}</TableCell>
                              <TableCell className="font-medium">
                                {inv.first_name || inv.last_name
                                  ? `${inv.first_name || ""} ${inv.last_name || ""}`.trim()
                                  : "Student"}
                                {inv.telegram_username && (
                                  <span className="text-muted-foreground ml-1">(@{inv.telegram_username})</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={inv.is_pro ? "default" : "outline"} className="text-[10px]">
                                  {inv.is_pro ? "PRO" : "Free"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground text-[10px]">
                                {formatDate(inv.created_at)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : null}

          {/* Dialog Action Footer */}
          <DialogFooter className="border-t pt-4 flex flex-wrap justify-between items-center gap-2">
            <div className="flex gap-2 flex-wrap">
              {selectedUser && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleTogglePro(selectedUser)}
                  >
                    {selectedUser.is_pro ? (
                      <>
                        <StarOff className="h-3.5 w-3.5 mr-1 text-amber-500" /> Revoke PRO
                      </>
                    ) : (
                      <>
                        <Star className="h-3.5 w-3.5 mr-1 text-blue-500" /> Make PRO
                      </>
                    )}
                  </Button>

                  {isSuperadmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        selectedUser.is_full_access
                          ? handleRevokeFullAccess(selectedUser.telegram_id)
                          : handleGrantFullAccess(selectedUser.telegram_id)
                      }
                    >
                      {selectedUser.is_full_access ? (
                        <>
                          <Lock className="h-3.5 w-3.5 mr-1 text-amber-500" /> Revoke Bypass
                        </>
                      ) : (
                        <>
                          <Unlock className="h-3.5 w-3.5 mr-1 text-green-500" /> Grant Bypass
                        </>
                      )}
                    </Button>
                  )}

                  {canBan && (
                    <Button
                      variant={selectedUser.is_banned ? "outline" : "destructive"}
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        selectedUser.is_banned
                          ? handleUnban(selectedUser)
                          : setBanDialog({ open: true, user: selectedUser, reason: "" })
                      }
                    >
                      {selectedUser.is_banned ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 mr-1 text-green-600" /> Unban
                        </>
                      ) : (
                        <>
                          <Ban className="h-3.5 w-3.5 mr-1" /> Ban
                        </>
                      )}
                    </Button>
                  )}

                  {isSuperadmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-red-600 border-red-400 hover:bg-red-50"
                      onClick={() => handleResetAccess(selectedUser)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset All
                    </Button>
                  )}
                </>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban Dialog */}
      <Dialog
        open={banDialog.open}
        onOpenChange={(open) => !open && setBanDialog({ open: false, user: null, reason: "" })}
      >
        <DialogContent className="border-2 border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Restrict Access
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to terminate access for{" "}
              <strong>{banDialog.user?.telegram_username ?? banDialog.user?.telegram_id}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Reason / Justification
            </Label>
            <Textarea
              placeholder="Provide reason for security logs..."
              className="resize-none"
              value={banDialog.reason}
              onChange={(e) => setBanDialog((s) => ({ ...s, reason: e.target.value }))}
            />
          </div>
          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-4">
            <Button
              variant="ghost"
              className="h-9"
              onClick={() => setBanDialog({ open: false, user: null, reason: "" })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-9"
              onClick={handleBan}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
