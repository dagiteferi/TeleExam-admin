import React, { useState, useEffect } from "react";
import { Settings, Plus, Pencil, Trash2, RefreshCw, Globe, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import axios from "axios";
import { getToken } from "@/lib/auth";

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

const defaultForm: SettingFormState = {
  key: "",
  value: "",
  description: "",
  is_public: false,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [openAdd, setOpenAdd] = useState(false);
  const [editingSetting, setEditingSetting] = useState<AppSetting | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState<SettingFormState>(defaultForm);
  const [saving, setSaving] = useState(false);

  const token = getToken();
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/settings`, authHeaders);
      setSettings(res.data);
    } catch (err) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // ── Add / Edit handlers ─────────────────────────────────────────────────────

  const openAddDialog = () => {
    setForm(defaultForm);
    setOpenAdd(true);
  };

  const openEditDialog = (s: AppSetting) => {
    setEditingSetting(s);
    setForm({
      key: s.key,
      value: s.value ?? "",
      description: s.description ?? "",
      is_public: s.is_public,
    });
  };

  const handleSave = async () => {
    if (!form.key.trim()) {
      toast.error("Key is required");
      return;
    }
    setSaving(true);
    try {
      await axios.put(
        `${API_BASE}/admin/settings/${encodeURIComponent(form.key)}`,
        {
          key: form.key,
          value: form.value || null,
          description: form.description || null,
          is_public: form.is_public,
        },
        authHeaders
      );
      toast.success(`Setting "${form.key}" saved`);
      setOpenAdd(false);
      setEditingSetting(null);
      fetchSettings();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to save setting");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingKey) return;
    try {
      await axios.delete(`${API_BASE}/admin/settings/${encodeURIComponent(deletingKey)}`, authHeaders);
      toast.success(`Setting "${deletingKey}" deleted`);
      setDeletingKey(null);
      fetchSettings();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete setting");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" /> App Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage configurable key-value settings for TeleExam AI. Public settings are
            served to the bot via <code className="text-xs bg-muted px-1 rounded">/api/public/settings</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-1" /> Add Setting
          </Button>
        </div>
      </div>

      {/* Well-known keys hint */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Well-Known Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            <code className="bg-muted px-1 rounded text-xs">support_contact_url</code> — Telegram
            handle or URL shown as the "Contact Support" button in the bot (e.g.{" "}
            <em>https://t.me/yourhandle</em>). Mark as <strong>Public</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Settings Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground animate-pulse">
          Loading settings…
        </div>
      ) : settings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No settings configured yet.{" "}
          <button onClick={openAddDialog} className="underline text-primary">
            Add one.
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {settings.map((s) => (
            <Card key={s.key} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{s.key}</span>
                    {s.is_public ? (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Globe className="h-3 w-3" /> Public
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Lock className="h-3 w-3" /> Private
                      </Badge>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                  )}
                  <p className="text-sm mt-1 break-all">
                    {s.value ? (
                      <span className="text-foreground">{s.value}</span>
                    ) : (
                      <span className="text-muted-foreground italic">— empty —</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(s)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingKey(s.key)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog
        open={openAdd || !!editingSetting}
        onOpenChange={(open) => {
          if (!open) {
            setOpenAdd(false);
            setEditingSetting(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSetting ? "Edit Setting" : "Add Setting"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="setting-key">Key</Label>
              <Input
                id="setting-key"
                placeholder="e.g. support_contact_url"
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                disabled={!!editingSetting}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="setting-value">Value</Label>
              <Input
                id="setting-value"
                placeholder="e.g. https://t.me/your_handle"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="setting-desc">Description (optional)</Label>
              <Textarea
                id="setting-desc"
                placeholder="Human-readable explanation of this setting"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 resize-none"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="setting-public"
                checked={form.is_public}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_public: v }))}
              />
              <Label htmlFor="setting-public" className="cursor-pointer">
                Public (visible to bot via <code className="text-xs bg-muted px-1 rounded">/api/public/settings</code>)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenAdd(false);
                setEditingSetting(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingKey} onOpenChange={(open) => !open && setDeletingKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Setting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <code className="font-mono bg-muted px-1 rounded">{deletingKey}</code>? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
