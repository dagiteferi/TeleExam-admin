import { useMemo, useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, g12Api } from "../api";
import { Loading, PageHeader, useLoad } from "../components/kit";
import MessageEditor from "../components/MessageEditor";

interface Setting {
  key: string;
  group: string;
  value: unknown;
  default: unknown;
}

const GROUPS: Record<string, string> = {
  access: "Access", payment: "Price & payment", study: "Study", ai: "AI Tutor", protection: "Protection",
  messages: "Messages", community: "Telegram & TikTok",
};

const RICH_TEXT = new Set(["community.message", "community.reward_message"]);

const LABELS: Record<string, [string, string]> = {
  "access.free_paper_years": ["Free exam years", "Oldest years of papers every free student can open."],
  "access.invite_bonus_years_per_invite": ["Years opened per invite", "Extra exam years each counted invite opens."],
  "access.invite_bonus_years_max": ["Most years from invites", "Invites can never open more years than this."],
  "access.newest_year_pro_only": ["Newest year is PRO only", "Invites never open the newest exam year."],
  "access.free_unit_percent": ["Free chapters (%)", "Share of each grade's chapters open to free students."],
  "access.invite_bonus_unit_percent": ["Chapters opened per invite (%)", "Extra share of chapters per counted invite."],
  "access.invite_unit_percent_max": ["Most chapters from invites (%)", "Invites can never open more than this share."],
  "access.last_unit_pro_only": ["Last chapter is PRO only", "Invites never open the last chapter of a grade."],
  "invites.min_answers_to_count": ["Answers before an invite counts", "0 = counts as soon as the friend picks a stream."],
  "price.amount": ["PRO price", "Shown in the bot and on lock pop-ups."],
  "price.currency": ["Currency", "Three letters, e.g. ETB."],
  "pro.period": ["PRO period", 'How long PRO lasts after a payment is approved. Lifetime: {"type": "lifetime"}. A date: {"type": "until_date", "value": "2027-07-31"}. Days: {"type": "days", "value": 90}.'],
  "support.contact": ["Support contact", "Telegram username shown to students."],
  "practice.default_count": ["Questions per practice", "Used when a student starts practice."],
  "practice.count_choices": ["Practice size choices", "JSON list, e.g. [10, 20, 30]."],
  "quiz.length": ["Quick quiz length", "Questions in a quick quiz."],
  "quiz.seconds_per_question": ["Quiz seconds per question", "Empty = no timer."],
  "exam.default_minutes_per_question": ["Exam minutes per question", "Used when a paper has no time of its own."],
  "exam.grace_seconds": ["Exam grace (seconds)", "Answers sent just after the deadline still count."],
  "session.checkpoint_every": ["Save progress every N answers", "How often running sessions are saved."],
  "session.idle_abandon_hours": ["Abandon idle sessions after (hours)", ""],
  "mastery.min_answers_mastered": ["Answers needed for mastered", ""],
  "mastery.mastered_percent": ["Mastered at (%)", ""],
  "mastery.min_answers_weak": ["Answers needed for weak", ""],
  "mastery.weak_percent": ["Weak below (%)", ""],
  "bookmarks.max_per_student": ["Most saved questions", ""],
  "reports.per_day": ["Reports per student per day", ""],
  "ai.enabled.explain": ["AI explanations on", "Turn off to stop Ask AI Tutor for everyone."],
  "ai.enabled.chat": ["AI follow-up chat on", ""],
  "ai.enabled.study_plan": ["AI study plan on", ""],
  "ai.free_explanations_per_day": ["Free AI explanations per day", ""],
  "ai.free_followups_per_day": ["Free AI follow-ups per day", ""],
  "ai.pro_hourly_fair_use": ["PRO AI calls per hour", "Hidden fair-use limit for PRO students."],
  "ai.per_minute": ["AI calls per minute (per student)", ""],
  "ai.max_input_chars": ["Longest follow-up question (characters)", ""],
  "ai.max_turns_per_chat": ["Follow-ups per chat", 'JSON: {"free": 10, "pro": 20}.'],
  "ai.max_output_tokens": ["Longest AI answer (tokens)", ""],
  "ai.timeout_seconds": ["AI timeout (seconds)", "Then the next model is tried."],
  "ai.pro_reserved_percent": ["AI capacity kept for PRO (%)", ""],
  "ai.day_timezone": ["Day resets in time zone", "e.g. Africa/Addis_Ababa."],
  "study_plan.days": ["Study plan days", ""],
  "study_plan.questions_per_day": ["Study plan questions per day", ""],
  "protect.questions_per_minute": ["Questions opened per minute", "Above this a student is slowed down."],
  "protect.questions_per_day": ["Questions opened per day", ""],
  "protect.questions_per_hour_flag": ["Flag above questions per hour", "Flags a student for review."],
  "protect.fast_answer_seconds": ["Too-fast answer (seconds)", ""],
  "protect.fast_answer_streak": ["Too-fast answers in a row to flag", ""],
  "protect.invite_burst": ["Invites in 10 minutes to flag", ""],
  "messages.welcome": ["Welcome message", "Sent once when a student starts the bot."],
  "messages.maintenance": ["Maintenance message", "When set, new sessions are paused and this is shown. Leave empty when not needed."],
  "messages.upgrade": ["Upgrade message", "Shown on the Upgrade to PRO screen."],
  "community.telegram_channel": ["Telegram channel", "Public channel students must join, like @TeleExamAI. The bot must be an admin of this channel to check who joined. Leave empty to turn this step off."],
  "community.telegram_required": ["Joining is required", "On: students can't use the bot until they join the channel. Off: the links are only suggested once."],
  "community.tiktok_url": ["TikTok link", "Shown as a 'Follow us on TikTok' button. Following can't be checked, so it is never required. Leave empty to hide it."],
  "community.message": ["Follow message", "Shown after the student chooses a stream, with the Join and Follow buttons."],
  "community.reward_message": ["Reward message", "Shown once the student has joined the channel."],
  "community.reward_pro_days": ["Reward: free PRO days", "Days of PRO given once for joining (0 = no PRO, only the reward message). Students who are already PRO get only the message."],
};

const isJson = (value: unknown) => typeof value === "object" && value !== null;

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return isJson(value) ? JSON.stringify(value) : String(value);
}

function parse(setting: Setting, text: string): unknown {
  const sample = setting.default ?? setting.value;
  if (text.trim() === "") return null;
  if (typeof sample === "number") {
    const number = Number(text);
    if (Number.isNaN(number)) throw new Error(`${setting.key} must be a number.`);
    return number;
  }
  if (isJson(sample)) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${setting.key} must be valid JSON.`);
    }
  }
  return text;
}

export default function G12SettingsPage() {
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<{ version: number; settings: Setting[] }>("/settings")).data);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("access");

  const groups = useMemo(() => {
    const result: Record<string, Setting[]> = {};
    for (const setting of data?.settings ?? []) (result[setting.group] ??= []).push(setting);
    return result;
  }, [data]);

  if (!data) return loading ? <Loading /> : null;
  const changed = Object.keys(edits).length;

  const save = async () => {
    setSaving(true);
    try {
      const changes: Record<string, unknown> = {};
      for (const setting of data.settings) {
        if (!(setting.key in edits)) continue;
        const raw = edits[setting.key];
        changes[setting.key] = typeof raw === "boolean" ? raw : parse(setting, String(raw));
      }
      await g12Api.patch("/settings", { version: data.version, changes });
      toast.success(`Saved ${Object.keys(changes).length} setting(s). The bot uses them within a minute.`);
      setEdits({});
      await reload();
    } catch (err) {
      toast.error(err instanceof Error && !("response" in err) ? err.message : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const field = (setting: Setting) => {
    const current = setting.key in edits ? edits[setting.key] : setting.value;
    const set = (value: unknown) => setEdits((all) => ({ ...all, [setting.key]: value }));
    const sample = setting.default ?? setting.value;
    if (typeof sample === "boolean") return <Switch checked={Boolean(current)} onCheckedChange={set} />;
    const text = typeof current === "string" && setting.key in edits ? current : toText(current);
    if (RICH_TEXT.has(setting.key)) {
      return <div className="w-full min-w-0 max-w-2xl"><MessageEditor value={text} onChange={set} maxLength={1000} rows={4} /></div>;
    }
    if (setting.group === "messages") {
      return <Textarea rows={3} value={text} onChange={(e) => set(e.target.value)} className="max-w-xl" />;
    }
    return <Input value={text} onChange={(e) => set(e.target.value)} className="max-w-xs"
                  inputMode={typeof sample === "number" ? "decimal" : undefined} />;
  };

  return (
    <>
      <PageHeader title="Settings" description="Every change is checked by the server, saved in the audit log and used by the bot without a redeploy."
        actions={<>
          <Button variant="outline" disabled={!changed || saving} onClick={() => setEdits({})}>
            <RotateCcw className="h-4 w-4 mr-2" />Undo
          </Button>
          <Button disabled={!changed || saving} onClick={save}>
            <Save className="h-4 w-4 mr-2" />Save {changed ? `(${changed})` : ""}
          </Button>
        </>} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {Object.keys(groups).map((group) => <TabsTrigger key={group} value={group}>{GROUPS[group] ?? group}</TabsTrigger>)}
        </TabsList>
        {Object.entries(groups).map(([group, settings]) => (
          <TabsContent key={group} value={group}>
            <Card>
              <CardContent className="divide-y p-0">
                {settings.map((setting) => {
                  const [label, help] = LABELS[setting.key] ?? [setting.key, ""];
                  return (
                    <div key={setting.key} className={`grid gap-2 p-4 ${RICH_TEXT.has(setting.key) ? "" : "md:grid-cols-[1fr_auto] md:items-center"}`}>
                      <div>
                        <p className="font-medium text-sm">{label}{setting.key in edits && <span className="text-primary"> •</span>}</p>
                        <p className="text-xs text-muted-foreground">{help} <code className="ml-1">{setting.key}</code></p>
                      </div>
                      {field(setting)}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
