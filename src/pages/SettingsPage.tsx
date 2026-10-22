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

// ── Types ──────────────────────────────────────────────────────────────────────

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

interface InvitationRules {
  free_years: number;
  invites_per_year: number;
  years_per_invite: number;
  invites_to_unlock_all_years: number;
  free_courses_ratio: number;
  invites_to_unlock_all_courses: number;
  invites_to_unlock_all: number;
  ai_bonus_per_invite: number;
  summary?: string;
  updated_at?: string | null;
}

const defaultForm: SettingFormState = { key: "", value: "", description: "", is_public: false };

const defaultRules: InvitationRules = {
  free_years: 1,
  invites_per_year: 1,
  years_per_invite: 1,
  invites_to_unlock_all_years: 4,
  free_courses_ratio: 0.25,
  invites_to_unlock_all_courses: 4,
  invites_to_unlock_all: 4,
  ai_bonus_per_invite: 0,
};

// ── Reusable number field ──────────────────────────────────────────────────────
function RuleField({
  id, label, hint, value, step = 1, min = 0, max, onChange,
}: {
  id: string; label: string; hint: string; value: number;
  step?: number; min?: number; max?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      <Input
        id={id} type="number" step={step} min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9"
      />
      <p className="text-xs text-muted-foreground leading-tight">{hint}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  // Generic settings
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [editingSetting, setEditingSetting] = useState<AppSetting | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [form, setForm] = useState<SettingFormState>(defaultForm);
  const [saving, setSaving] = useState(false);

  // Invitation rules
  const [rules, setRules] = useState<InvitationRules>(defaultRules);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesSaving, setRulesSaving] = useState(false);

  const token = getToken();
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/settings/invitation`, authHeaders);
      setRules(res.data);
    } catch {
      toast.error("Failed to load referral rules");
    } finally {
      setRulesLoading(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/settings`, authHeaders);
      setSettings(res.data);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); fetchSettings(); }, []);

  // ── Save referral rules ────────────────────────────────────────────────────
  const handleSaveRules = async () => {
    setRulesSaving(true);
    try {
      const { summary, updated_at, ...payload } = rules;
      const res = await axios.put(`${API_BASE}/admin/settings/invitation`, payload, authHeaders);
      setRules(res.data);
      toast.success("Referral rules saved successfully!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to save referral rules");
    } finally {
      setRulesSaving(false);
    }
  };

  const updateRule = <K extends keyof InvitationRules>(key: K, val: InvitationRules[K]) =>
    setRules((r) => ({ ...r, [key]: val }));

  // ── Generic setting handlers ───────────────────────────────────────────────
  const openAddDialog = () => { setForm(defaultForm); setOpenAdd(true); };

  const openEditDialog = (s: AppSetting) => {
    setEditingSetting(s);
    setForm({ key: s.key, value: s.value ?? "", description: s.description ?? "", is_public: s.is_public });
  };

  const handleSave = async () => {
    if (!form.key.trim()) { toast.error("Key is required"); return; }
    setSaving(true);
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
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingKey) return;
    try {
      await axios.delete(`${API_BASE}/admin/settings/${encodeURIComponent(deletingKey)}`, authHeaders);
      toast.success(`Setting "${deletingKey}" deleted`);
      setDeletingKey(null); fetchSettings();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete setting");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10 p-6">

      {/* ════════════ REFERRAL & UNLOCK RULES ════════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">🔗 Referral &amp; Unlock Rules</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure how invites unlock exam years, courses, and AI bonuses. Changes take effect immediately.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRules} disabled={rulesLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${rulesLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleSaveRules} disabled={rulesSaving || rulesLoading}>
              <Save className="h-4 w-4 mr-1" />
              {rulesSaving ? "Saving…" : "Save Rules"}
            </Button>
          </div>
        </div>

        {/* Summary banner */}
        {rules.summary && !rulesLoading && (
          <Card className="mb-4 border-primary/30 bg-primary/5">
            <CardContent className="py-3 px-4 flex items-start gap-3">
              <span className="text-xl">📋</span>
              <div>
                <p className="text-sm font-semibold text-primary">Active Rule Summary</p>
                <p className="text-sm text-muted-foreground">{rules.summary}</p>
                {rules.updated_at && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last updated: {new Date(rules.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {rulesLoading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Loading referral rules…</div>
        ) : (
          <div className="grid gap-4">

            {/* Exam Year Rules */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">📅 Exam Year Unlock Rules</CardTitle>
                <CardDescription>
                  Control which historical exam years users can access based on their invite count.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <RuleField
                  id="free_years" label="Free Years"
                  hint="Oldest exam years available for free with 0 invites."
                  value={rules.free_years} min={0}
                  onChange={(v) => updateRule("free_years", v)}
                />
                <RuleField
                  id="invites_per_year" label="Invites per Year"
                  hint="Invites required to unlock each additional exam year."
                  value={rules.invites_per_year} min={1}
                  onChange={(v) => updateRule("invites_per_year", v)}
                />
                <RuleField
                  id="years_per_invite" label="Years per Invite"
                  hint="Exam years unlocked by a single invite (set >1 to be generous)."
                  value={rules.years_per_invite} min={1}
                  onChange={(v) => updateRule("years_per_invite", v)}
                />
                <RuleField
                  id="invites_to_unlock_all_years" label="Invites → All Years"
                  hint="Total invites to unlock ALL exam years in a department."
                  value={rules.invites_to_unlock_all_years} min={0}
                  onChange={(v) => updateRule("invites_to_unlock_all_years", v)}
                />
              </CardContent>
            </Card>

            {/* Course Rules */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">📚 Course Unlock Rules</CardTitle>
                <CardDescription>
                  Control how many courses within an exam year are accessible.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <RuleField
                  id="free_courses_ratio" label="Free Courses Ratio"
                  hint="Fraction of courses free by default (0.0 – 1.0). E.g. 0.25 = 25% free."
                  value={rules.free_courses_ratio} step={0.05} min={0} max={1}
                  onChange={(v) => updateRule("free_courses_ratio", Math.min(1, Math.max(0, v)))}
                />
                <RuleField
                  id="invites_to_unlock_all_courses" label="Invites → All Courses"
                  hint="Total invites needed to unlock every course within a year."
                  value={rules.invites_to_unlock_all_courses} min={0}
                  onChange={(v) => updateRule("invites_to_unlock_all_courses", v)}
                />
                {/* Visual helper */}
                <div className="flex items-end pb-1">
                  <div className="w-full rounded-lg border bg-muted/50 px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round(rules.free_courses_ratio * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">of courses free</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Universal + AI Bonus */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🌐 Universal Threshold &amp; AI Bonus</CardTitle>
                <CardDescription>
                  A single threshold that unlocks everything, plus optional AI daily-bonus per invite.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <RuleField
                  id="invites_to_unlock_all" label="Universal Unlock Threshold"
                  hint="Reaching this count instantly unlocks ALL years AND courses for that user."
                  value={rules.invites_to_unlock_all} min={0}
                  onChange={(v) => updateRule("invites_to_unlock_all", v)}
                />
                <RuleField
                  id="ai_bonus_per_invite" label="AI Bonus per Invite"
                  hint="Extra free daily AI explanations awarded per invite. Set 0 to disable."
                  value={rules.ai_bonus_per_invite} min={0}
                  onChange={(v) => updateRule("ai_bonus_per_invite", v)}
                />
              </CardContent>
            </Card>

          </div>
        )}
      </section>

      {/* ════════════ GENERIC APP SETTINGS ════════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings className="h-5 w-5" /> App Settings
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Manage configurable key-value settings. Public settings are served via{" "}
              <code className="text-xs bg-muted px-1 rounded">/api/public/settings</code>.
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
        <Card className="border-dashed mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Well-Known Keys</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>
              <code className="bg-muted px-1 rounded text-xs">support_contact_url</code> — Telegram handle or URL for the "Contact Support" button. Mark as <strong>Public</strong>.
            </p>
            <p>
              <code className="bg-muted px-1 rounded text-xs">invitation_rules</code> — JSON blob managed by the Referral Rules panel above.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground animate-pulse">Loading settings…</div>
        ) : settings.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No settings configured yet.{" "}
            <button onClick={openAddDialog} className="underline text-primary">Add one.</button>
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
                        <Badge variant="secondary" className="text-xs gap-1"><Globe className="h-3 w-3" /> Public</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" /> Private</Badge>
                      )}
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                    <p className="text-sm mt-1 break-all">
                      {s.value
                        ? <span className="text-foreground">{s.value}</span>
                        : <span className="text-muted-foreground italic">— empty —</span>}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(s)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingKey(s.key)} title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={openAdd || !!editingSetting} onOpenChange={(open) => { if (!open) { setOpenAdd(false); setEditingSetting(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSetting ? "Edit Setting" : "Add Setting"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="setting-key">Key</Label>
              <Input
                id="setting-key" placeholder="e.g. support_contact_url"
                value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                disabled={!!editingSetting} className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="setting-value">Value</Label>
              <Input
                id="setting-value" placeholder="e.g. https://t.me/your_handle"
                value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="setting-desc">Description (optional)</Label>
              <Textarea
                id="setting-desc" placeholder="Human-readable explanation"
                value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 resize-none" rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="setting-public" checked={form.is_public} onCheckedChange={(v) => setForm((f) => ({ ...f, is_public: v }))} />
              <Label htmlFor="setting-public" className="cursor-pointer">
                Public (visible via <code className="text-xs bg-muted px-1 rounded">/api/public/settings</code>)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenAdd(false); setEditingSetting(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deletingKey} onOpenChange={(open) => !open && setDeletingKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Setting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <code className="font-mono bg-muted px-1 rounded">{deletingKey}</code>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
