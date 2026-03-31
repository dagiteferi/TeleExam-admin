import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Loader2, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/api";
import type { Permission } from "@/lib/auth";

const ALL_PERMISSIONS: { value: Permission; label: string }[] = [
  { value: "view_users", label: "View Users" },
  { value: "ban_user", label: "Ban Users" },
  { value: "view_stats", label: "View Stats" },
  { value: "manage_content", label: "Manage Content" },
];

interface Admin {
  email: string;
  permissions: Permission[];
  is_superadmin: boolean;
}

const inviteSchema = z.object({
  email: z.string().email("Invalid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(128),
});

type InviteForm = z.infer<typeof inviteSchema>;

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePerms, setInvitePerms] = useState<Permission[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [editPerms, setEditPerms] = useState<Permission[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
  });

  const fetchAdmins = () => {
    setLoading(true);
    api
      .get("/admin/auth/admins")
      .then((r) => setAdmins(r.data))
      .catch(() => {
        setAdmins([
          { email: "superadmin@teleexam.ai", permissions: ["*" as Permission], is_superadmin: true },
          { email: "moderator@teleexam.ai", permissions: ["view_users", "view_stats"], is_superadmin: false },
        ]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAdmins(); }, []);

  const onInvite = async (data: InviteForm) => {
    setInviteLoading(true);
    try {
      await api.post("/admin/auth/invite", { ...data, permissions: invitePerms });
      toast.success("Admin invited successfully");
      setInviteOpen(false);
      reset();
      setInvitePerms([]);
      fetchAdmins();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to invite admin");
    } finally {
      setInviteLoading(false);
    }
  };

  const onUpdatePerms = async () => {
    if (!editAdmin) return;
    setEditLoading(true);
    try {
      await api.patch(`/admin/auth/admins/${editAdmin.email}/permissions`, { permissions: editPerms });
      toast.success("Permissions updated");
      setEditAdmin(null);
      fetchAdmins();
    } catch {
      toast.error("Failed to update permissions");
    } finally {
      setEditLoading(false);
    }
  };

  const togglePerm = (perms: Permission[], perm: Permission, setter: (p: Permission[]) => void) => {
    setter(perms.includes(perm) ? perms.filter((p) => p !== perm) : [...perms, perm]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Management</h1>
          <p className="text-muted-foreground text-sm">Manage admin accounts and permissions</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Invite Admin
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (
                admins.map((admin) => (
                  <TableRow key={admin.email}>
                    <TableCell className="font-medium">{admin.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {admin.is_superadmin || admin.permissions.includes("*" as Permission) ? (
                          <Badge>Superadmin</Badge>
                        ) : (
                          admin.permissions.map((p) => <Badge key={p} variant="secondary">{p}</Badge>)
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {!admin.is_superadmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditAdmin(admin); setEditPerms([...admin.permissions]); }}
                        >
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New Admin</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onInvite)} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={invitePerms.includes(p.value)}
                      onCheckedChange={() => togglePerm(invitePerms, p.value, setInvitePerms)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editAdmin} onOpenChange={(open) => !open && setEditAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permissions — {editAdmin?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={editPerms.includes(p.value)}
                    onCheckedChange={() => togglePerm(editPerms, p.value, setEditPerms)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdmin(null)}>Cancel</Button>
            <Button onClick={onUpdatePerms} disabled={editLoading}>
              {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
