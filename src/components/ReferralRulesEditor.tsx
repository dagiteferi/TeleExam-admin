import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, GraduationCap, BookOpen, Bot, RefreshCw, RotateCcw, Save, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface InvitationRules {
  free_years: number;
  invites_per_year: number;
  years_per_invite: number;
  max_invite_years: number;
  free_courses_ratio: number;
  courses_per_invite: number;
  max_invite_courses_ratio: number;
  lock_newest_year: boolean;
  lock_last_course: boolean;
  free_ai_daily_limit: number;
  ai_bonus_per_invite: number;
}

type RuleKey = keyof InvitationRules;

// Same defaults as the backend (app/schemas/invitation.py)
const DEFAULT_RULES: InvitationRules = {
  free_years: 1, invites_per_year: 1, years_per_invite: 1, max_invite_years: 1,
  free_courses_ratio: 0.25, courses_per_invite: 1, max_invite_courses_ratio: 1,
  lock_newest_year: true, lock_last_course: true,
  free_ai_daily_limit: 5, ai_bonus_per_invite: 0,
};
const RULE_KEYS = Object.keys(DEFAULT_RULES) as RuleKey[];
const NEW_RULE_KEYS: RuleKey[] = ["max_invite_courses_ratio", "lock_newest_year", "lock_last_course", "free_ai_daily_limit"];
const PREVIEW_INVITES = [0, 1, 2, 3, 5, 10];

const pick = (data: Record<string, unknown>): InvitationRules =>
  Object.fromEntries(RULE_KEYS.map((k) => [k, k in data ? data[k] : DEFAULT_RULES[k]])) as unknown as InvitationRules;

// Mirrors InvitationRuleConfig in the backend: what a student with `invites` gets
export function computeUnlocks(r: InvitationRules, invites: number, totalYears: number, totalCourses: number) {
  const freeYears = Math.min(r.free_years, totalYears);
  const yearCeiling = r.lock_newest_year ? totalYears - 1 : totalYears;
  const yearCap = Math.max(freeYears, Math.min(yearCeiling, freeYears + r.max_invite_years));
  const extraYears = r.years_per_invite > 1 ? invites * r.years_per_invite : Math.floor(invites / r.invites_per_year);
  const years = Math.max(freeYears, Math.min(yearCap, freeYears + extraYears));

  const freeCourses = Math.min(totalCourses, Math.max(1, Math.floor(totalCourses * r.free_courses_ratio)));
  const courseCeiling = r.lock_last_course ? totalCourses - 1 : totalCourses;
  const courseCap = Math.max(freeCourses, Math.min(courseCeiling, Math.floor(totalCourses * r.max_invite_courses_ratio)));
  const courses = Math.min(courseCap, freeCourses + invites * r.courses_per_invite);

  return { years, yearCap, freeYears, courses, courseCap, freeCourses, ai: r.free_ai_daily_limit + invites * r.ai_bonus_per_invite };
}

/** Smallest number of invites that reaches the invite maximum (years and courses). */
function invitesToMax(r: InvitationRules, totalYears: number, totalCourses: number) {
  const { yearCap, courseCap } = computeUnlocks(r, 0, totalYears, totalCourses);
  for (let n = 0; n <= 500; n++) {
    const u = computeUnlocks(r, n, totalYears, totalCourses);
    if (u.years >= yearCap && u.courses >= courseCap) return n;
  }
  return null;
}

// ─── Small building blocks ────────────────────────────────────────────────

function Field({ label, help, children }: { label: string; help: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3 border-b last:border-b-0">
      <div className="min-w-0 sm:max-w-[60%]">
        <Label className="text-sm font-semibold">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{help}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min = 0, max = 100, suffix }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? Math.round(v) : min));
  return (
    <div className="flex items-center gap-1.5">
      <Button type="button" variant="outline" size="icon" className="h-9 w-9"
        onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease">
        <Minus className="h-4 w-4" />
      </Button>
      <Input type="number" inputMode="numeric" className="h-9 w-16 text-center font-semibold tabular-nums"
        value={value} min={min} max={max}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))} />
      <Button type="button" variant="outline" size="icon" className="h-9 w-9"
        onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Increase">
        <Plus className="h-4 w-4" />
      </Button>
      {suffix && <span className="text-sm text-muted-foreground w-14">{suffix}</span>}
    </div>
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 w-64">
      <Slider min={0} max={100} step={5} value={[Math.round(value * 100)]}
        onValueChange={([v]) => onChange(v / 100)} className="flex-1" />
      <span className="w-12 text-right font-semibold tabular-nums">{Math.round(value * 100)}%</span>
    </div>
  );
}

function ProSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm ${checked ? "font-semibold text-primary" : "text-muted-foreground"}`}>
        {checked ? "PRO only" : "Invites can open it"}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Step({ n, icon, title, description, children }: {
  n: number; icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">{n}</span>
          {icon} {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────

export default function ReferralRulesEditor() {
  const [saved, setSaved] = useState<InvitationRules>(DEFAULT_RULES);
  const [draft, setDraft] = useState<InvitationRules>(DEFAULT_RULES);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backendHasNewRules, setBackendHasNewRules] = useState(true);
  // Example department used for the preview only
  const [exampleYears, setExampleYears] = useState(5);
  const [exampleCourses, setExampleCourses] = useState(10);

  const applyResponse = (data: Record<string, unknown>) => {
    const rules = pick(data);
    setSaved(rules);
    setDraft(rules);
    setUpdatedAt((data.updated_at as string) ?? null);
    setBackendHasNewRules(NEW_RULE_KEYS.every((k) => k in data));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/settings/invitation");
      applyResponse(res.data);
    } catch {
      toast.error("Failed to load referral rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changedKeys = RULE_KEYS.filter((k) => draft[k] !== saved[k]);
  const dirty = changedKeys.length > 0;
  const set = <K extends RuleKey>(key: K, value: InvitationRules[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // "Several invites open 1 year" vs "1 invite opens several years" — only one can be active
  const yearMode = draft.years_per_invite > 1 ? "years_per_invite" : "invites_per_year";
  const setYearMode = (mode: string) =>
    setDraft((d) => mode === "years_per_invite"
      ? { ...d, invites_per_year: 1, years_per_invite: Math.max(2, d.years_per_invite) }
      : { ...d, years_per_invite: 1 });

  const save = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(changedKeys.map((k) => [k, draft[k]]));
      const res = await api.patch("/admin/settings/invitation", payload);
      applyResponse(res.data);
      const ignored = changedKeys.filter((k) => !(k in res.data));
      if (ignored.length) toast.warning("Some rules were not saved: the API server needs to be updated first.");
      else toast.success("Referral rules saved. The bot uses them within about 5 minutes.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to save referral rules");
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(
    () => PREVIEW_INVITES.map((n) => ({ n, ...computeUnlocks(draft, n, exampleYears, exampleCourses) })),
    [draft, exampleYears, exampleCourses],
  );
  const maxAt = invitesToMax(draft, exampleYears, exampleCourses);
  const caps = computeUnlocks(draft, 0, exampleYears, exampleCourses);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Referral &amp; Invitation Rules</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Decide what students get for free and what each invited friend unlocks. Change the values, check the
            preview, then press <strong>Save changes</strong>.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            A friend counts as an invite only after they start the bot <strong>and choose their department</strong>.
            Saving never messages users; the bot uses the new rules within about 5 minutes.
            {updatedAt && <> Last saved {new Date(updatedAt).toLocaleString()}.</>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={saving}>
          <RefreshCw className="h-4 w-4 mr-1" /> Reload
        </Button>
      </div>

      {!backendHasNewRules && (
        <p className="text-sm rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
          ⚠️ The API server is an older version. The course limit, PRO-only switches and free AI limit won't be saved
          until it is updated. The other rules work normally.
        </p>
      )}

      <Step n={1} icon={<Gift className="h-4 w-4" />} title="Free for everyone"
        description="What every student gets without inviting anyone.">
        <Field label="Free exam years" help="The oldest exam years in each department are free. 0 = no free years.">
          <NumberInput value={draft.free_years} onChange={(v) => set("free_years", v)} suffix="years" />
        </Field>
        <Field label="Free courses"
          help={`Share of courses that are free. Example: ${caps.freeCourses} of ${exampleCourses} courses (always at least 1).`}>
          <PercentInput value={draft.free_courses_ratio} onChange={(v) => set("free_courses_ratio", v)} />
        </Field>
      </Step>

      <Step n={2} icon={<GraduationCap className="h-4 w-4" />} title="Exam years opened by invites"
        description="Years open from oldest to newest.">
        <Field label="How invites open years" help="Pick one way. Usually 'several invites open 1 year'.">
          <RadioGroup value={yearMode} onValueChange={setYearMode} className="gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="invites_per_year" /> Several invites open 1 year
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="years_per_invite" /> 1 invite opens several years
            </label>
          </RadioGroup>
        </Field>
        {yearMode === "invites_per_year" ? (
          <Field label="Invites needed for 1 year" help="E.g. 3 = a student must invite 3 friends to open the next year.">
            <NumberInput value={draft.invites_per_year} onChange={(v) => set("invites_per_year", v)} min={1} suffix="invites" />
          </Field>
        ) : (
          <Field label="Years opened by 1 invite" help="E.g. 2 = each invited friend opens 2 more years.">
            <NumberInput value={draft.years_per_invite} onChange={(v) => set("years_per_invite", v)} min={2} suffix="years" />
          </Field>
        )}
        <Field label="Most years invites can open"
          help="Extra years on top of the free ones. Everything above this needs PRO.">
          <NumberInput value={draft.max_invite_years} onChange={(v) => set("max_invite_years", v)} suffix="years" />
        </Field>
        <Field label="Newest exam year" help="PRO only: invites can never open the newest year.">
          <ProSwitch checked={draft.lock_newest_year} onChange={(v) => set("lock_newest_year", v)} />
        </Field>
      </Step>

      <Step n={3} icon={<BookOpen className="h-4 w-4" />} title="Courses opened by invites"
        description="Courses open in the order they're listed in the bot.">
        <Field label="Courses opened by 1 invite" help="E.g. 1 = each invited friend opens one more course.">
          <NumberInput value={draft.courses_per_invite} onChange={(v) => set("courses_per_invite", v)} min={1} suffix="courses" />
        </Field>
        <Field label="Most courses invites can open"
          help={`Share of all courses (free ones included). Example: up to ${caps.courseCap} of ${exampleCourses} courses. 100% = no limit.`}>
          <PercentInput value={draft.max_invite_courses_ratio} onChange={(v) => set("max_invite_courses_ratio", v)} />
        </Field>
        <Field label="Last course" help="PRO only: invites can never open the last course.">
          <ProSwitch checked={draft.lock_last_course} onChange={(v) => set("lock_last_course", v)} />
        </Field>
      </Step>

      <Step n={4} icon={<Bot className="h-4 w-4" />} title="AI explanations for free users"
        description="PRO users have no daily AI limit.">
        <Field label="Free AI explanations per day" help="For every non-PRO student. 0 = AI is PRO only (plus invite bonus).">
          <NumberInput value={draft.free_ai_daily_limit} onChange={(v) => set("free_ai_daily_limit", v)} max={1000} suffix="/ day" />
        </Field>
        <Field label="Extra AI per invite" help="Bonus explanations per day for each invited friend. 0 = off.">
          <NumberInput value={draft.ai_bonus_per_invite} onChange={(v) => set("ai_bonus_per_invite", v)} max={1000} suffix="/ day" />
        </Field>
      </Step>

      <Card className="border-2 border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preview: what a student gets</CardTitle>
          <CardDescription>
            Uses the values above (saved or not). Set the size of an example department:
          </CardDescription>
          <div className="flex flex-wrap gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Exam years</Label>
              <NumberInput value={exampleYears} onChange={setExampleYears} min={1} max={30} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Courses</Label>
              <NumberInput value={exampleCourses} onChange={setExampleCourses} min={1} max={60} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Friends invited</TableHead>
                <TableHead>Exam years open</TableHead>
                <TableHead>Courses open</TableHead>
                <TableHead>AI per day</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((p) => (
                <TableRow key={p.n}>
                  <TableCell className="font-semibold">{p.n}</TableCell>
                  <TableCell>{p.years} of {exampleYears}{p.years >= p.yearCap && p.n > 0 && <Badge variant="secondary" className="ml-2">max</Badge>}</TableCell>
                  <TableCell>{p.courses} of {exampleCourses}{p.courses >= p.courseCap && p.n > 0 && <Badge variant="secondary" className="ml-2">max</Badge>}</TableCell>
                  <TableCell>{p.ai}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm mt-3">
            {maxAt === null
              ? "Invites never reach the maximum with these rules."
              : <>Invites reach the maximum at <strong>{maxAt} friend{maxAt !== 1 ? "s" : ""}</strong>:{" "}
                {caps.yearCap} of {exampleYears} years and {caps.courseCap} of {exampleCourses} courses.</>}
            {" "}
            {caps.yearCap >= exampleYears && caps.courseCap >= exampleCourses
              ? <span className="font-semibold text-amber-600">Invites can open everything, so PRO only adds unlimited AI.</span>
              : <span className="text-muted-foreground">Everything else needs <strong>PRO</strong>.</span>}
          </p>
        </CardContent>
      </Card>

      {/* Save bar: stays visible at the bottom while there are unsaved changes */}
      <div className={`sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg transition-colors ${
        dirty ? "bg-amber-50 border-amber-400 dark:bg-amber-950/60" : "bg-card"
      }`}>
        <p className="text-sm">
          {dirty
            ? <><strong>{changedKeys.length} unsaved change{changedKeys.length !== 1 ? "s" : ""}.</strong> Students still see the old rules until you save.</>
            : <span className="text-muted-foreground">All changes saved.</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDraft(saved)} disabled={!dirty || saving}>
            <RotateCcw className="h-4 w-4 mr-1" /> Undo changes
          </Button>
          <Button onClick={save} disabled={!dirty || saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </section>
  );
}
