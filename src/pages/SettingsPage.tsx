import React, { useState, useEffect, useCallback } from "react";
import {
  Settings, Plus, Pencil, Trash2, RefreshCw,
  Globe, Lock, Save, Users, Zap, Gift,
  ChevronRight, Info, Check, X, Eye,
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
  max_invite_years: number;
  free_courses_ratio: number;
  courses_per_invite: number;
  ai_bonus_per_invite: number;
  summary?: string;
  updated_at?: string | null;
}
const defaultForm: SettingFormState = { key: "", value: "", description: "", is_public: false };
const defaultRules: InvitationRules = {
  free_years: 1, invites_per_year: 2, years_per_invite: 1, max_invite_years: 1,
  free_courses_ratio: 0.25, courses_per_invite: 1, ai_bonus_per_invite: 0,
};

// Live Preview
function LivePreview({ rules }: { rules: InvitationRules }) {
  const [preview, setPreview] = useState(2);
  const totalYears = 5;
  const totalCourses = 8;
  // Mirrors the backend: invites never unlock the newest year or the last course (PRO only)
  const freeYears = Math.min(rules.free_years, totalYears);
  const yearCap = Math.max(freeYears, Math.min(totalYears - 1, freeYears + rules.max_invite_years));
  const extraYears = rules.years_per_invite > 1
    ? preview * rules.years_per_invite
    : Math.floor(preview / rules.invites_per_year);
  const unlockedYears = Math.max(freeYears, Math.min(yearCap, freeYears + extraYears));
  const baseCourses = Math.min(totalCourses, Math.max(1, Math.floor(totalCourses * rules.free_courses_ratio)));
  const courseCap = Math.max(baseCourses, totalCourses - 1);
  const unlockedCourses = Math.min(courseCap, baseCourses + preview * rules.courses_per_invite);
  const maxedOut = unlockedYears >= yearCap && unlockedCourses >= courseCap;
  const aiLimit = 5 + preview * rules.ai_bonus_per_invite;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Live Preview — What does a student get?
        </CardTitle>
        <CardDescription>Drag the slider to simulate a student who has invited that many friends.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">Student has invited</Label>
            <span className="text-2xl font-bold text-primary">{preview} friend{preview !== 1 ? "s" : ""}</span>
          </div>
          <Slider min={0} max={10} step={1} value={[preview]}
            onValueChange={([v]) => setPreview(v)} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 invites</span>
            <span>10 invites</span>
          </div>
        </div>
        <div className={`rounded-lg px-4 py-2 text-center border ${maxedOut ? "bg-green-500/10 border-green-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
          <p className={`font-semibold text-sm ${maxedOut ? "text-green-600" : "text-amber-600"}`}>
            {maxedOut
              ? "Max reachable by invites. The newest year and full access still require PRO."
              : "Full access is PRO only. Invites never unlock the newest year or every course."}
          </p>
        </div>
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

// Individual editable rule row
type RuleRowProps = {
  label: string;
  sublabel: string;
  tooltip?: string;
  savedValue: number;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  onSave: (v: number) => Promise<void>;
};

function RuleRow({
  label, sublabel, tooltip, savedValue, min = 0, max, step = 1, format, onSave,
}: RuleRowProps) {
  const isRatio = step >= 0.05 && step < 0.5;
  const defaultFmt = isRatio ? (v: number) => `${Math.round(v * 100)}%` : (v: number) => String(v);
  const fmt = format ?? defaultFmt;
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(savedValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setLocalVal(savedValue);
  }, [savedValue, editing]);

  const dec = () => setLocalVal((v) => Math.max(min, parseFloat((v - step).toFixed(4))));
  const inc = () => setLocalVal((v) =>
    max !== undefined ? Math.min(max, parseFloat((v + step).toFixed(4))) : parseFloat((v + step).toFixed(4))
  );

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(localVal); setEditing(false); } finally { setSaving(false); }
  };
  const handleCancel = () => { setLocalVal(savedValue); setEditing(false); };

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      editing ? "border-primary/60 bg-primary/5 shadow-sm" : "bg-muted/20 hover:bg-muted/40"
    }`}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold">{label}</span>
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
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{sublabel}</p>
        </div>
        {!editing ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <span className="text-2xl font-black tabular-nums text-primary">{fmt(savedValue)}</span>
              <p className="text-xs text-muted-foreground">current</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
              onClick={() => setEditing(true)} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            {isRatio ? (
              <div className="flex flex-col items-end gap-1 w-36">
                <span className="text-2xl font-black tabular-nums text-primary">{fmt(localVal)}</span>
                <Slider min={min} max={max ?? 1} step={step} value={[localVal]}
                  onValueChange={([v]) => setLocalVal(v)} className="w-full" />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg"
                  onClick={dec} disabled={localVal <= min}>
                  <span className="text-base font-bold">-</span>
                </Button>
                <span className="text-xl font-bold w-12 text-center tabular-nums">{fmt(localVal)}</span>
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg"
                  onClick={inc} disabled={max !== undefined && localVal >= max}>
                  <span className="text-base font-bold">+</span>
                </Button>
              </div>
            )}
            <div className="flex gap-1 ml-1">
              <Button size="icon" className="h-7 w-7 rounded-lg bg-green-600 hover:bg-green-700"
                onClick={handleSave} disabled={saving} title="Save">
                <Check className="h-3.5 w-3.5 text-white" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                onClick={handleCancel} title="Cancel">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ icon, title, description, children }: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-2.5">{children}</CardContent>
    </Card>
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
  const [savedRules, setSavedRules] = useState<InvitationRules>(defaultRules);
  const [rulesLoading, setRulesLoading] = useState(true);

  const token = getToken();
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/settings/invitation`, authHeaders);
      setSavedRules(res.data);
    } catch {
      toast.error("Failed to load referral rules");
    } finally {
      setRulesLoading(false);
    }
  }, []);

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

  useEffect(() => { fetchRules(); fetchSettings(); }, []);

  const saveOneRule = useCallback(async <K extends keyof InvitationRules>(key: K, val: InvitationRules[K]) => {
    const updated = { ...savedRules, [key]: val };
    const { summary, updated_at, ...payload } = updated;
    try {
      const res = await axios.put(`${API_BASE}/admin/settings/invitation`, payload, authHeaders);
      setSavedRules(res.data);
      toast.success("Saved!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to save");
      throw err;
    }
  }, [savedRules]);

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

      {/* Current config snapshot */}
      {!rulesLoading && (
        <Card className="border-dashed bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Eye className="h-4 w-4" /> Current Live Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { label: "Free Years", value: savedRules.free_years },
                { label: "Invites / Year", value: savedRules.invites_per_year },
                { label: "Free Courses", value: `${Math.round(savedRules.free_courses_ratio * 100)}%` },
                { label: "Courses / Invite", value: savedRules.courses_per_invite },
                { label: "Full Access", value: "PRO only" },
                { label: "Years / Invite", value: savedRules.years_per_invite },
                { label: "Max Years by Invites", value: savedRules.max_invite_years },
                { label: "AI Bonus", value: savedRules.ai_bonus_per_invite === 0 ? "Off" : `+${savedRules.ai_bonus_per_invite}/invite` },
              ] as { label: string; value: string | number }[]).map((item) => (
                <div key={item.label} className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-bold mt-0.5 tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
            {savedRules.updated_at && (
              <p className="text-xs text-muted-foreground mt-3">
                Last updated: {new Date(savedRules.updated_at).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Referral Rules */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Referral &amp; Invitation Rules</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Click the pencil on any rule to edit it. Each change saves immediately.
            </p>
            <p className="text-sm mt-2 rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-blue-700 dark:text-blue-300">
              ℹ️ Saving a rule does <strong>not</strong> send any message to users. The bot simply uses the new rules
              (within about 5 minutes) the next time a student opens exams, courses or 🤝 Invite Friends.
            </p>
            <p className="text-sm mt-2 text-muted-foreground">
              A friend counts as an invite only after they start the bot <strong>and choose their department</strong>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRules} disabled={rulesLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${rulesLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {rulesLoading ? (
          <div className="grid gap-3">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            <SectionCard
              icon={<span className="text-lg">🎁</span>}
              title="Free Access (No Invites Needed)"
              description="What every student gets for free before they invite anyone."
            >
              <RuleRow
                label="Free Exam Years"
                sublabel="How many of the oldest exam years students can access with zero invites."
                tooltip="Set to 1 to give the oldest year free. Set to 0 to lock all years behind invites."
                savedValue={savedRules.free_years}
                min={0}
                onSave={(v) => saveOneRule("free_years", v)}
              />
              <RuleRow
                label="Free Courses Ratio"
                sublabel="What percentage of courses within each year are free by default."
                tooltip="0% = all courses locked, 100% = all free. 25% is a good starting point."
                savedValue={savedRules.free_courses_ratio}
                min={0} max={1} step={0.05}
                onSave={(v) => saveOneRule("free_courses_ratio", v)}
              />
            </SectionCard>

            <SectionCard
              icon={<Users className="h-5 w-5 text-blue-500" />}
              title="What Each Invite Unlocks"
              description="How exam years get unlocked as students invite more friends."
            >
              <RuleRow
                label="Invites Needed per Extra Year"
                sublabel="E.g. '1' = every invite unlocks one more year. '2' = 2 invites needed per year."
                tooltip="Lower = more generous. A value of 1 is recommended."
                savedValue={savedRules.invites_per_year}
                min={1}
                onSave={(v) => saveOneRule("invites_per_year", v)}
              />
              <RuleRow
                label="Years Unlocked per Invite"
                sublabel="E.g. '2' = one invite opens 2 years at once. Usually keep at 1."
                tooltip="Works opposite to 'invites per year'. Use one or the other, not both."
                savedValue={savedRules.years_per_invite}
                min={1}
                onSave={(v) => saveOneRule("years_per_invite", v)}
              />
              <RuleRow
                label="Max Extra Years by Invites"
                sublabel="The most exam years invites can ever open beyond the free ones. Every other year requires PRO."
                tooltip="E.g. '1' with 2 invites per year = 2 invites open one extra year, and the rest need payment."
                savedValue={savedRules.max_invite_years}
                min={0}
                onSave={(v) => saveOneRule("max_invite_years", v)}
              />
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4 mt-2">
                <p className="text-xs font-semibold text-blue-600 mb-2">Milestone preview with current settings:</p>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  {[0, 1, 2, 3, 5]
                    .map((invites, idx, arr) => {
                      const extra = savedRules.years_per_invite > 1
                        ? invites * savedRules.years_per_invite
                        : Math.floor(invites / savedRules.invites_per_year);
                      const years = `${savedRules.free_years + Math.min(extra, savedRules.max_invite_years)}`;
                      return (
                        <React.Fragment key={invites}>
                          <div className="rounded-lg border bg-white dark:bg-card px-3 py-1.5 text-xs font-medium text-center">
                            <span className="text-muted-foreground">{invites} invite{invites !== 1 ? "s" : ""}</span>
                            <ChevronRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                            <span className="font-bold text-foreground">{years} year{Number(years) !== 1 ? "s" : ""}</span>
                          </div>
                          {idx < arr.length - 1 && <span className="text-muted-foreground">to</span>}
                        </React.Fragment>
                      );
                    })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Invites open at most {savedRules.max_invite_years} extra year{savedRules.max_invite_years !== 1 ? "s" : ""}, and never the newest year. Every other year requires PRO.</p>
              </div>
            </SectionCard>

            <SectionCard
              icon={<span className="text-lg">📚</span>}
              title="Courses Unlocked by Invites"
              description="How practice courses open up beyond the free ones."
            >
              <RuleRow
                label="Courses Unlocked per Invite"
                sublabel="E.g. '1' = every invite unlocks one more course. The last course always stays PRO only."
                savedValue={savedRules.courses_per_invite}
                min={1}
                onSave={(v) => saveOneRule("courses_per_invite", v)}
              />
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-bold text-primary">💎 Full access is PRO only</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Invites can never unlock <strong>everything</strong>. The newest exam year in each department and
                  the last course always require a PRO payment.
                </p>
              </div>
            </SectionCard>

            <SectionCard
              icon={<Gift className="h-5 w-5 text-purple-500" />}
              title="AI Explanation Bonus"
              description="Optionally reward students with extra daily AI explanations per invite."
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <RuleRow
                    label="Bonus AI Explanations per Invite"
                    sublabel={
                      savedRules.ai_bonus_per_invite === 0
                        ? "Currently disabled — all students get the same base AI limit (5/day)."
                        : `A student with 5 invites gets ${5 + 5 * savedRules.ai_bonus_per_invite} AI explanations/day.`
                    }
                    tooltip="Set to 0 to disable. Base is 5 AI explanations/day for all students."
                    savedValue={savedRules.ai_bonus_per_invite}
                    min={0}
                    onSave={(v) => saveOneRule("ai_bonus_per_invite", v)}
                  />
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 text-center min-w-[110px]">
                  <p className="text-xs text-muted-foreground">Base limit</p>
                  <p className="text-3xl font-black">5</p>
                  <p className="text-xs text-muted-foreground">questions/day</p>
                  {savedRules.ai_bonus_per_invite > 0 && (
                    <>
                      <Separator className="my-2" />
                      <p className="text-xs text-muted-foreground">With 5 invites</p>
                      <p className="text-2xl font-black text-purple-500">
                        {5 + 5 * savedRules.ai_bonus_per_invite}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </SectionCard>

            <LivePreview rules={savedRules} />
          </div>
        )}
      </section>

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
