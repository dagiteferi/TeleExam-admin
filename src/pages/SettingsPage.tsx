import { useState, useEffect, useCallback } from "react";
import {
  Settings, Plus, Pencil, Trash2, RefreshCw,
  Globe, Lock, Save,
  Check, Video, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import axios from "axios";
import { getToken } from "@/lib/auth";
import ReferralRulesEditor from "@/components/ReferralRulesEditor";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface AppSetting {
  key: string;
  value: string | null;
  description: string | null;
  is_public: boolean;
}
interface SettingFormState {
  key: string;
  value: string;
  description: string;
  is_public: boolean;
}
const defaultForm: SettingFormState = { key: "", value: "", description: "", is_public: false };

interface RecordingUser {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  department_name: string | null;
  can_record?: boolean;
}

const userLabel = (u: RecordingUser) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.telegram_username || String(u.telegram_id);

// Users allowed to screenshot / screen-record the bot (e.g. the marketing team)
function RecordingAccessCard() {
  const [allowed, setAllowed] = useState<RecordingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<RecordingUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const authHeaders = { headers: { Authorization: `Bearer ${getToken()}` } };

  const fetchAllowed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/users/`, {
        ...authHeaders, params: { can_record: true, limit: 200 },
      });
      setAllowed(res.data);
    } catch {
      toast.error("Failed to load recording access");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllowed(); }, []);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(`${API_BASE}/admin/users/`, {
          ...authHeaders, params: { search: q, limit: 10 },
        });
        setResults(res.data);
      } catch {
        toast.error("User search failed");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const setRecording = async (u: RecordingUser, allow: boolean) => {
    setBusyId(u.id);
    try {
      await axios.post(`${API_BASE}/admin/users/${u.id}/recording`, undefined, {
        ...authHeaders, params: { allowed: allow },
      });
      toast.success(allow ? `${userLabel(u)} can now record the bot` : `Recording removed for ${userLabel(u)}`);
      setResults((rs) => rs.map((r) => (r.id === u.id ? { ...r, can_record: allow } : r)));
      fetchAllowed();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update recording access");
    } finally {
      setBusyId(null);
    }
  };

  const allowedIds = new Set(allowed.map((u) => u.id));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Video className="h-5 w-5" /> Screen Recording Access
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Bot messages are protected for everyone. Users listed here (e.g. the marketing team) can
            take screenshots and record the bot. The user gets a message and it applies immediately.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAllowed} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div>
            <Label htmlFor="rec-search">Add a user</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="rec-search" className="pl-9"
                placeholder="Search by name, username or Telegram ID"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {search.trim() && (
              <div className="mt-2 rounded-lg border divide-y">
                {searching ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground animate-pulse">Searching...</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No users found.</p>
                ) : results.map((u) => {
                  const isAllowed = allowedIds.has(u.id) || !!u.can_record;
                  return (
                    <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{userLabel(u)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.telegram_username ? `@${u.telegram_username} · ` : ""}{u.telegram_id}
                          {u.department_name ? ` · ${u.department_name}` : ""}
                        </p>
                      </div>
                      {isAllowed ? (
                        <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Allowed</Badge>
                      ) : (
                        <Button size="sm" onClick={() => setRecording(u, true)} disabled={busyId === u.id}>
                          <Plus className="h-4 w-4 mr-1" /> Allow
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold mb-2">Allowed users ({allowed.length})</p>
            {loading ? (
              <div className="h-12 rounded-lg bg-muted animate-pulse" />
            ) : allowed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody can record the bot right now.</p>
            ) : (
              <div className="rounded-lg border divide-y">
                {allowed.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{userLabel(u)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.telegram_username ? `@${u.telegram_username} · ` : ""}{u.telegram_id}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => setRecording(u, false)} disabled={busyId === u.id}>
                      <Trash2 className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [editingSetting, setEditingSetting] = useState<AppSetting | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [form, setForm] = useState<SettingFormState>(defaultForm);
  const [formSaving, setFormSaving] = useState(false);

  const token = getToken();
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/settings`, authHeaders);
      setSettings(res.data);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, []);

  const openAddDialog = () => { setForm(defaultForm); setOpenAdd(true); };
  const openEditDialog = (s: AppSetting) => {
    setEditingSetting(s);
    setForm({ key: s.key, value: s.value ?? "", description: s.description ?? "", is_public: s.is_public });
  };
  const handleSaveSetting = async () => {
    if (!form.key.trim()) { toast.error("Key is required"); return; }
    setFormSaving(true);
    try {
      await axios.put(
        `${API_BASE}/admin/settings/${encodeURIComponent(form.key)}`,
        { key: form.key, value: form.value || null, description: form.description || null, is_public: form.is_public },
        authHeaders
      );
      toast.success(`Setting "${form.key}" saved`);
      setOpenAdd(false); setEditingSetting(null); fetchSettings();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to save setting");
    } finally { setFormSaving(false); }
  };
  const handleDeleteSetting = async () => {
    if (!deletingKey) return;
    try {
      await axios.delete(`${API_BASE}/admin/settings/${encodeURIComponent(deletingKey)}`, authHeaders);
      toast.success(`Setting "${deletingKey}" deleted`);
      setDeletingKey(null); fetchSettings();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete setting");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" /> Configuration Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage referral rules and app settings. Click the pencil icon on any rule to edit it individually.
        </p>
      </div>

      <ReferralRulesEditor />

      <RecordingAccessCard />

      {/* App Settings */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings className="h-5 w-5" /> Other App Settings
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Key-value configuration for the bot. Public settings are sent to the bot automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loadingSettings}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loadingSettings ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1" /> Add Setting
            </Button>
          </div>
        </div>

        <Card className="border-dashed mb-4">
          <CardContent className="py-3 px-4 text-sm text-muted-foreground">
            <p>
              <code className="bg-muted px-1 rounded text-xs">support_contact_url</code> — The Telegram handle shown as "Contact Support" in the bot. Mark as <strong>Public</strong>.
            </p>
          </CardContent>
        </Card>

        {loadingSettings ? (
          <div className="text-center py-16 text-muted-foreground animate-pulse">Loading...</div>
        ) : settings.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No settings yet.{" "}
            <button onClick={openAddDialog} className="underline text-primary">Add one.</button>
          </div>
        ) : (
          <div className="grid gap-3">
            {settings.map((s) => (
              <Card key={s.key} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-semibold text-sm">{s.key}</span>
                      {s.is_public
                        ? <Badge variant="secondary" className="text-xs gap-1"><Globe className="h-3 w-3" /> Public</Badge>
                        : <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" /> Private</Badge>}
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground mb-1">{s.description}</p>}
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-mono">
                      {s.value
                        ? <span className="text-foreground break-all">{s.value}</span>
                        : <span className="text-muted-foreground italic">empty</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(s)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingKey(s.key)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={openAdd || !!editingSetting} onOpenChange={(o) => { if (!o) { setOpenAdd(false); setEditingSetting(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSetting ? "Edit Setting" : "Add Setting"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="skey">Key</Label>
              <Input id="skey" placeholder="e.g. support_contact_url" value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                disabled={!!editingSetting} className="mt-1 font-mono" />
            </div>
            <div>
              <Label htmlFor="sval">Value</Label>
              <Input id="sval" placeholder="e.g. https://t.me/your_handle" value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="sdesc">Description (optional)</Label>
              <Textarea id="sdesc" placeholder="What this setting does" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 resize-none" rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="spublic" checked={form.is_public}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_public: v }))} />
              <Label htmlFor="spublic" className="cursor-pointer text-sm">Make public (visible to bot)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenAdd(false); setEditingSetting(null); }}>Cancel</Button>
            <Button onClick={handleSaveSetting} disabled={formSaving}>
              <Save className="h-4 w-4 mr-1" />{formSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingKey} onOpenChange={(o) => !o && setDeletingKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Setting</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <code className="font-mono bg-muted px-1 rounded">{deletingKey}</code>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
