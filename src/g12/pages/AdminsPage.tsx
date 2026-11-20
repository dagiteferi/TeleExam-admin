import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { g12Api } from "../api";
import { useG12Auth } from "../auth";
import { Loading, PageHeader, run, useLoad, when } from "../components/kit";

interface AdminUser { id: string; email: string; role: string; is_active: boolean; last_login_at: string | null }

const ROLES: [string, string][] = [
  ["owner", "Owner: everything"], ["admin", "Admin: all but admins and AI keys"],
  ["editor", "Editor: content and review"], ["viewer", "Viewer: read only"],
];

export default function G12AdminsPage() {
  const { admin: me } = useG12Auth();
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<AdminUser[]>("/admin-users")).data);
  const [form, setForm] = useState({ email: "", password: "", role: "editor" });

  const add = async () => {
    if (await run(() => g12Api.post("/admin-users", form), "Admin added.")) {
      setForm({ email: "", password: "", role: "editor" });
      reload();
    }
  };
  const patch = async (user: AdminUser, body: object) => {
    if (await run(() => g12Api.patch(`/admin-users/${user.id}`, body), "Saved.")) reload();
  };

  return (
    <>
      <PageHeader title="Admins" description="People who can sign in to the Grade 12 panel." />
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Add an admin</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_220px_auto] items-end">
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1"><Label>Password (12+ characters)</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="space-y-1"><Label>Role</Label>
            <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select></div>
          <Button disabled={!form.email || form.password.length < 12} onClick={add}><Plus className="h-4 w-4 mr-1" />Add</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {loading ? <Loading /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Last sign-in</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}{u.id === me?.id ? " (you)" : ""}</TableCell>
                    <TableCell>
                      <Select value={u.role} disabled={u.id === me?.id} onValueChange={(role) => patch(u, { role })}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map(([value]) => <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{when(u.last_login_at)}</TableCell>
                    <TableCell><Switch checked={u.is_active} disabled={u.id === me?.id} onCheckedChange={(is_active) => patch(u, { is_active })} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
