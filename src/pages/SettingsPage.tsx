import React, { useState, useEffect } from "react";
import {
  Settings, Plus, Pencil, Trash2, RefreshCw,
  Globe, Lock, Save, Users, BookOpen, Zap, Gift,
  ChevronRight, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
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
  free_years: 1, invites_per_year: 1, years_per_invite: 1,
  invites_to_unlock_all_years: 4, free_courses_ratio: 0.25,
  invites_to_unlock_all_courses: 4, invites_to_unlock_all: 4, ai_bonus_per_invite: 0,
};

// ── Live Preview ───────────────────────────────────────────────────────────────
function LivePreview({ rules }: { rules: InvitationRules }) {
  const [preview, setPreview] = useState(2);
  const totalYears = 5; // example
  const totalCourses = 8; // example

  const isFullyUnlocked = preview >= rules.invites_to_unlock_all;

  // Unlocked years
  let unlockedYears: number;
  if (isFullyUnlocked) {
    unlockedYears = totalYears;
  } else {
    const extra = rules.years_per_invite > 1
      ? preview * rules.years_per_invite
      : Math.floor(preview / rules.invites_per_year);
    unlockedYears = Math.min(totalYears, rules.free_years + extra);
  }

  // Unlocked courses
  let unlockedCourses: number;
  const courseThreshold = Math.min(rules.invites_to_unlock_all, rules.invites_to_unlock_all_courses);
  if (isFullyUnlocked || preview >= courseThreshold) {
    unlockedCourses = totalCourses;
  } else {
    const base = Math.max(1, Math.floor(totalCourses * rules.free_courses_ratio));
    const extra2 = courseThreshold > 0 ? Math.floor(preview * (totalCourses - base) / courseThreshold) : 0;
    unlockedCourses = Math.min(totalCourses, base + extra2);
  }

  const aiLimit = 5 + preview * rules.ai_bonus_per_invite;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Live Preview — See How It Works
        </CardTitle>
        <CardDescription>
          Drag the slider to see what a user with that many invites can access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Invite slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">User has invited</Label>
            <span className="text-2xl font-bold text-primary">{preview}</span>
          </div>
          <Slider
            min={0} max={Math.max(rules.invites_to_unlock_all + 2, 10)}
            step={1} value={[preview]}
            onValueChange={([v]) => setPreview(v)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 invites</span>
            <span>{Math.max(rules.invites_to_unlock_all + 2, 10)} invites</span>
          </div>
        </div>

        {/* Status badge */}
        {isFullyUnlocked ? (
          <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-2 text-center">
            <p className="text-green-600 font-bold text-sm">🎉 Full Access Unlocked!</p>
            <p className="text-xs text-muted-foreground">This user can access everything.</p>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-center">
            <p className="text-amber-600 font-semibold text-sm">
              Needs {rules.invites_to_unlock_all - preview} more invite{rules.invites_to_unlock_all - preview !== 1 ? "s" : ""} for full access
            </p>
          </div>
        )}

        {/* Access grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">📅 Exam Years</p>
            <p className="text-xl font-bold">{unlockedYears}<span className="text-sm text-muted-foreground">/{totalYears}</span></p>
            <div className="flex gap-0.5 justify-center mt-1">
              {Array.from({ length: totalYears }).map((_, i) => (
                <div key={i} className={`h-1.5 w-4 rounded-full ${i < unlockedYears ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">📚 Courses</p>
            <p className="text-xl font-bold">{unlockedCourses}<span className="text-sm text-muted-foreground">/{totalCourses}</span></p>
            <div className="flex gap-0.5 justify-center mt-1 flex-wrap">
              {Array.from({ length: totalCourses }).map((_, i) => (
                <div key={i} className={`h-1.5 w-3 rounded-full ${i < unlockedCourses ? "bg-blue-500" : "bg-muted"}`} />
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">🤖 Daily AI</p>
            <p className="text-xl font-bold">{aiLimit}</p>
            <p className="text-xs text-muted-foreground">questions/day</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center italic">
          * Preview uses example data (5 years, 8 courses). Real numbers depend on each department.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Setting Card helper ────────────────────────────────────────────────────────
function SettingBlock({
  icon, title, description, children,
}: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          {icon} {title}
        </CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── Number stepper ─────────────────────────────────────────────────────────────
function NumberStepper({
  label, sublabel, tooltip, value, min = 0, max, step = 1, onChange,
}: {
  label: string; sublabel?: string; tooltip?: string;
  value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(max !== undefined ? Math.min(max, value + step) : value + step);

  return (
    <div className="rounded-xl border bg-muted/30 p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {sublabel && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{sublabel}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={dec} disabled={value <= min}>
            <span className="text-base font-bold">−</span>
          </Button>
          <span className="text-xl font-bold w-10 text-center tabular-nums">{step < 1 ? value.toFixed(2) : value}</span>
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={inc} disabled={max !== undefined && value >= max}>
            <span className="text-base font-bold">+</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
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
  const [isDirty, setIsDirty] = useState(false);

  const token = getToken();
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/settings/invitation`, authHeaders);
      setRules(res.data);
      setIsDirty(false);
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

  const handleSaveRules = async () => {
    setRulesSaving(true);
    try {
      const { summary, updated_at, ...payload } = rules;
      const res = await axios.put(`${API_BASE}/admin/settings/invitation`, payload, authHeaders);
      setRules(res.data);
      setIsDirty(false);
      toast.success("✅ Referral rules saved! Changes are now live.");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to save referral rules");
    } finally {
      setRulesSaving(false);
    }
  };

  const updateRule = <K extends keyof InvitationRules>(key: K, val: InvitationRules[K]) => {
    setRules((r) => ({ ...r, [key]: val }));
    setIsDirty(true);
  };

  // Generic settings
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

  return (
    <div className="max-w-4xl mx-auto space-y-10 p-6">

      {/* ══════════ SECTION 1: REFERRAL RULES ══════════ */}
      <section>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">🔗 Referral &amp; Invitation Settings</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              Control what users can unlock by inviting friends. These rules apply to all students automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDirty && (
              <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 animate-pulse">
                Unsaved changes
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={fetchRules} disabled={rulesLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${rulesLoading ? "animate-spin" : ""}`} />
              Reset
            </Button>
            <Button size="sm" onClick={handleSaveRules} disabled={rulesSaving || rulesLoading}
              className={isDirty ? "bg-primary shadow-md shadow-primary/30" : ""}>
              <Save className="h-4 w-4 mr-1" />
              {rulesSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>

        {rulesLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-5">

            {/* ── BLOCK 1: Free Access ── */}
            <SettingBlock
              icon={<span className="text-lg">🎁</span>}
              title="Free Access (No Invites Needed)"
              description="What every student gets for free, before they invite anyone."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberStepper
                  label="Free Exam Years"
                  sublabel="How many of the oldest exam years students can access without any invites."
                  tooltip="Set to 1 to give the oldest year for free. Set to 0 to lock all years behind invites."
                  value={rules.free_years} min={0}
                  onChange={(v) => updateRule("free_years", v)}
                />
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm font-semibold mb-1">Free Courses</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    What percentage of courses in each year is free by default.
                  </p>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={0} max={1} step={0.05}
                      value={[rules.free_courses_ratio]}
                      onValueChange={([v]) => updateRule("free_courses_ratio", v)}
                      className="flex-1"
                    />
                    <span className="text-2xl font-bold w-16 text-right tabular-nums text-primary">
                      {Math.round(rules.free_courses_ratio * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Drag to set the free course percentage (0% = all locked, 100% = all free)
                  </p>
                </div>
              </div>
            </SettingBlock>

            {/* ── BLOCK 2: Invite Rewards ── */}
            <SettingBlock
              icon={<Users className="h-5 w-5 text-blue-500" />}
              title="What Each Invite Unlocks"
              description="How many exam years a student unlocks each time they bring in a new friend."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberStepper
                  label="Invites needed per extra year"
                  sublabel="E.g. set to 1 = every invite unlocks 1 more year. Set to 2 = need 2 invites per year."
                  tooltip="Lower = more generous. Higher = students need to invite more people per year unlocked."
                  value={rules.invites_per_year} min={1}
                  onChange={(v) => updateRule("invites_per_year", v)}
                />
                <NumberStepper
                  label="Years unlocked per invite"
                  sublabel="E.g. set to 2 = each invite unlocks 2 exam years at once. Usually keep at 1."
                  tooltip="Use this if you want to be extra generous — 1 invite opens multiple years."
                  value={rules.years_per_invite} min={1}
                  onChange={(v) => updateRule("years_per_invite", v)}
                />
              </div>

              {/* Visual example */}
              <div className="mt-4 rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
                <p className="text-xs font-semibold text-blue-600 mb-2">📖 Example with your current settings:</p>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  {[0, 1, 2, 3, rules.invites_to_unlock_all].filter((v, i, a) => a.indexOf(v) === i).map((invites, idx, arr) => {
                    const extra = rules.years_per_invite > 1
                      ? invites * rules.years_per_invite
                      : Math.floor(invites / rules.invites_per_year);
                    const years = invites >= rules.invites_to_unlock_all ? "All" : `${rules.free_years + extra}`;
                    return (
                      <React.Fragment key={invites}>
                        <div className="text-center">
                          <div className="rounded-lg border bg-white dark:bg-card px-3 py-1.5 text-xs font-medium">
                            <span className="text-muted-foreground">{invites} invite{invites !== 1 ? "s" : ""}</span>
                            <ChevronRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                            <span className="font-bold text-foreground">{years} year{years !== "All" && Number(years) !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        {idx < arr.length - 1 && <span className="text-muted-foreground text-lg">→</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </SettingBlock>

            {/* ── BLOCK 3: Full Unlock ── */}
            <SettingBlock
              icon={<span className="text-lg">🔓</span>}
              title="Full Unlock Thresholds"
              description="How many total invites a student needs to unlock absolutely everything."
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumberStepper
                  label="Invites to unlock all years"
                  sublabel="Once a student reaches this number, all exam years open up."
                  tooltip="This is the maximum — even if the per-invite calculation says fewer, this is the cap."
                  value={rules.invites_to_unlock_all_years} min={0}
                  onChange={(v) => updateRule("invites_to_unlock_all_years", v)}
                />
                <NumberStepper
                  label="Invites to unlock all courses"
                  sublabel="Once reached, all courses within every year are fully accessible."
                  value={rules.invites_to_unlock_all_courses} min={0}
                  onChange={(v) => updateRule("invites_to_unlock_all_courses", v)}
                />
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex flex-col justify-between">
                  <div>
                    <p className="text-sm font-bold text-primary flex items-center gap-1">
                      ⭐ Master Unlock Threshold
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-tight">
                      When a student reaches this number, <strong>everything</strong> (years + courses) unlocks instantly.
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                      onClick={() => updateRule("invites_to_unlock_all", Math.max(0, rules.invites_to_unlock_all - 1))}
                      disabled={rules.invites_to_unlock_all <= 0}>
                      <span className="text-base font-bold">−</span>
                    </Button>
                    <span className="text-3xl font-black text-primary tabular-nums">{rules.invites_to_unlock_all}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                      onClick={() => updateRule("invites_to_unlock_all", rules.invites_to_unlock_all + 1)}>
                      <span className="text-base font-bold">+</span>
                    </Button>
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-1">total invites</p>
                </div>
              </div>
            </SettingBlock>

            {/* ── BLOCK 4: AI Bonus ── */}
            <SettingBlock
              icon={<Gift className="h-5 w-5 text-purple-500" />}
              title="AI Explanation Bonus (Optional)"
              description="Reward students with extra daily AI question explanations for each friend they invite."
            >
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <NumberStepper
                    label="Bonus AI explanations per invite"
                    sublabel={
                      rules.ai_bonus_per_invite === 0
                        ? "Currently disabled — all users get the same base AI limit (5/day)."
                        : `A student with ${rules.invites_to_unlock_all} invites gets ${5 + rules.invites_to_unlock_all * rules.ai_bonus_per_invite} AI explanations/day.`
                    }
                    tooltip="Set to 0 to disable the bonus. The base daily limit for all users is 5 AI explanations/day."
                    value={rules.ai_bonus_per_invite} min={0}
                    onChange={(v) => updateRule("ai_bonus_per_invite", v)}
                  />
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 text-center min-w-[120px]">
                  <p className="text-xs text-muted-foreground">Base limit</p>
                  <p className="text-3xl font-black">5</p>
                  <p className="text-xs text-muted-foreground">questions/day</p>
                  {rules.ai_bonus_per_invite > 0 && (
                    <>
                      <Separator className="my-2" />
                      <p className="text-xs text-muted-foreground">With max invites</p>
                      <p className="text-2xl font-black text-purple-500">
                        {5 + rules.invites_to_unlock_all * rules.ai_bonus_per_invite}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </SettingBlock>

            {/* ── LIVE PREVIEW ── */}
            <LivePreview rules={rules} />

            {/* ── Save bar ── */}
            {isDirty && (
              <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-xl border bg-background/95 backdrop-blur shadow-lg px-5 py-3 z-10">
                <p className="text-sm font-medium">You have unsaved changes to the referral rules.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={fetchRules}>Discard</Button>
                  <Button size="sm" onClick={handleSaveRules} disabled={rulesSaving}
                    className="bg-primary shadow-md shadow-primary/30">
                    <Save className="h-4 w-4 mr-1" />
                    {rulesSaving ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══════════ SECTION 2: APP SETTINGS ══════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings className="h-5 w-5" /> Other App Settings
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Key-value configuration for the bot. Public settings are sent to the bot automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1" /> Add Setting
            </Button>
          </div>
        </div>

        {/* Hint */}
        <Card className="border-dashed mb-4">
          <CardContent className="py-3 px-4 text-sm text-muted-foreground space-y-1">
            <p>
              <code className="bg-muted px-1 rounded text-xs">support_contact_url</code> — The Telegram handle shown as "Contact Support" in the bot. Mark as <strong>Public</strong>.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground animate-pulse">Loading…</div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{s.key}</span>
                      {s.is_public
                        ? <Badge variant="secondary" className="text-xs gap-1"><Globe className="h-3 w-3" /> Public</Badge>
                        : <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" /> Private</Badge>}
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

      {/* ── Add/Edit Dialog ─────────────────────────────────────────────────── */}
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
              <Label htmlFor="spublic" className="cursor-pointer text-sm">Make this setting public (visible to the bot)</Label>
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

      {/* ── Delete Dialog ───────────────────────────────────────────────────── */}
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
            <AlertDialogAction onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
