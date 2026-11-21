import { useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import { Activity, BookOpen, ChevronRight, CreditCard, Crown, Database, FileWarning, PenLine, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { g12Api } from "../api";
import { Loading, PageHeader, StatusBadge, useLoad } from "../components/kit";

interface Dashboard {
  users: { total: number; active_today: number; active_7d: number; new_today: number; natural: number; social: number };
  pro_users: number;
  revenue: string;
  pending_payments: number;
  study: { answered_today: number; active_sessions: number; exams_today: number };
  content: { ready_questions: number; hidden_questions: number; open_reports: number };
  db_bytes: number;
}

interface Health {
  status: string;
  db: { status: string };
  redis: { status: string };
  storage: { status: string };
}

interface GrowthDay {
  day: string;
  new_students: number;
  total_students: number;
  active_students: number;
  answers: number;
  pro_upgrades: number;
}

type Tone = "blue" | "green" | "violet" | "amber" | "teal" | "indigo" | "rose" | "slate";

const TONES: Record<Tone, string> = {
  blue: "border-l-blue-500 [&_.icon]:bg-blue-500/10 [&_.icon]:text-blue-600",
  green: "border-l-emerald-500 [&_.icon]:bg-emerald-500/10 [&_.icon]:text-emerald-600",
  violet: "border-l-violet-500 [&_.icon]:bg-violet-500/10 [&_.icon]:text-violet-600",
  amber: "border-l-amber-500 [&_.icon]:bg-amber-500/10 [&_.icon]:text-amber-600",
  teal: "border-l-teal-500 [&_.icon]:bg-teal-500/10 [&_.icon]:text-teal-600",
  indigo: "border-l-indigo-500 [&_.icon]:bg-indigo-500/10 [&_.icon]:text-indigo-600",
  rose: "border-l-rose-500 [&_.icon]:bg-rose-500/10 [&_.icon]:text-rose-600",
  slate: "border-l-slate-500 [&_.icon]:bg-slate-500/10 [&_.icon]:text-slate-600",
};

const number = (value: number | string) => Number(value).toLocaleString();

function LinkCard({ to, title, value, description, icon: Icon, tone }: {
  to: string; title: string; value: string; description: string; icon: ElementType; tone: Tone;
}) {
  const inner = (
    <Card className={cn("border-l-4 h-full transition hover:shadow-md hover:-translate-y-0.5 group", TONES[tone])}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <span className="icon rounded-lg p-2"><Icon className="h-4 w-4" /></span>
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          {description}<ChevronRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition" />
        </p>
      </CardContent>
    </Card>
  );
  return to.startsWith("#")
    ? <a href={to} className="block">{inner}</a>
    : <Link to={to} className="block">{inner}</Link>;
}

const SERIES: { key: keyof GrowthDay; label: string; color: string }[] = [
  { key: "total_students", label: "Total students (right scale)", color: "#3b82f6" },
  { key: "active_students", label: "Active students", color: "#10b981" },
  { key: "new_students", label: "New students", color: "#f59e0b" },
];

function GrowthChart() {
  const [days, setDays] = useState("30");
  const { data, loading } = useLoad(async () =>
    (await g12Api.get<GrowthDay[]>("/analytics/growth", { params: { days } })).data, [days]);
  const rows = (data ?? []).map((d) => ({ ...d, label: new Date(`${d.day}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  const totals = rows.reduce((sum, d) => ({ new: sum.new + d.new_students, answers: sum.answers + d.answers, pro: sum.pro + d.pro_upgrades }),
    { new: 0, answers: 0, pro: 0 });

  return (
    <Card id="growth" className="mt-6 scroll-mt-20">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Growth</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {number(totals.new)} new students · {number(totals.answers)} answers · {number(totals.pro)} PRO upgrades in this period
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem></SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="h-80">
        {loading && !data ? <Loading /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} minTickGap={16} />
              <YAxis yAxisId="daily" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <YAxis yAxisId="total" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map((s) => (
                <Area key={s.key} yAxisId={s.key === "total_students" ? "total" : "daily"} type="monotone" dataKey={s.key}
                      name={s.label} stroke={s.color} strokeWidth={2}
                      fill={`url(#fill-${s.key})`} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function G12DashboardPage() {
  const { data, loading } = useLoad(async () => {
    const [dashboard, health] = await Promise.all([
      g12Api.get<Dashboard>("/dashboard"),
      g12Api.get<Health>("/system/health").catch(() => ({ data: null })),
    ]);
    return { dashboard: dashboard.data, health: health.data };
  });

  if (loading || !data) return <Loading />;
  const { dashboard: d, health } = data;
  return (
    <>
      <PageHeader title="Grade 12 Dashboard" description="Tap a card to open the details." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LinkCard to="/12/students" tone="blue" icon={Users} title="Students" value={number(d.users.total)}
                  description={`${number(d.users.natural)} Natural · ${number(d.users.social)} Social`} />
        <LinkCard to="/12/students" tone="green" icon={Activity} title="Active today" value={number(d.users.active_today)}
                  description={`${number(d.users.active_7d)} in 7 days · ${number(d.users.new_today)} new today`} />
        <LinkCard to="/12/students?plan=pro" tone="violet" icon={Crown} title="PRO students" value={number(d.pro_users)}
                  description={`Revenue: ${number(d.revenue)} ETB`} />
        <LinkCard to="/12/payments" tone="amber" icon={CreditCard} title="Pending payments" value={number(d.pending_payments)}
                  description="Receipts waiting for review" />
        <LinkCard to="#growth" tone="teal" icon={PenLine} title="Answered today" value={number(d.study.answered_today)}
                  description={`${number(d.study.exams_today)} exams · ${number(d.study.active_sessions)} running now`} />
        <LinkCard to="/12/content" tone="indigo" icon={BookOpen} title="Ready questions" value={number(d.content.ready_questions)}
                  description={`${number(d.content.hidden_questions)} hidden`} />
        <LinkCard to="/12/review" tone="rose" icon={FileWarning} title="Open reports" value={number(d.content.open_reports)}
                  description="Problems reported by students" />
        <LinkCard to="/12/system" tone="slate" icon={Database} title="Database size" value={`${(d.db_bytes / 1024 / 1024).toFixed(0)} MB`}
                  description="Supabase free plan: 500 MB" />
      </div>
      <GrowthChart />
      {health && (
        <Link to="/12/system" className="block">
          <Card className="mt-6 transition hover:shadow-md">
            <CardHeader><CardTitle className="text-base">Service health</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <span className="flex items-center gap-2">Overall <StatusBadge value={health.status} /></span>
              <span className="flex items-center gap-2">Database <StatusBadge value={health.db.status} /></span>
              <span className="flex items-center gap-2">Redis <StatusBadge value={health.redis.status} /></span>
              <span className="flex items-center gap-2">File storage <StatusBadge value={health.storage.status} /></span>
            </CardContent>
          </Card>
        </Link>
      )}
    </>
  );
}
