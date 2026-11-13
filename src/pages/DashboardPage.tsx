import { useEffect, useState } from "react";
import { Users, FileText, Activity, Ban, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface DepartmentCount {
  department_id: string;
  name: string;
  users: number;
  pro_users: number;
}

interface SummaryData {
  total_users: number;
  user_growth_percent: number;
  total_exams: number;
  exam_sessions?: number;
  practice_sessions?: number;
  today_dau: number;
  banned_users: number;
  chart_data: Array<{ day: string; dau: number }>;
  users_by_department?: DepartmentCount[];
  users_without_department?: number;
}

// Departments past this many share one "Other" slice, so every slice keeps a distinct color.
const MAX_SLICES = 7;
const OTHER_COLOR = "hsl(var(--muted-foreground))";

interface Slice {
  key: string;
  name: string;
  users: number;
  pro_users: number;
  free_users: number;
  share: number;
  color: string;
  members?: string[]; // departments folded into "Other"
}

function toSlices(departments: DepartmentCount[]): Slice[] {
  const assigned = departments.reduce((sum, d) => sum + d.users, 0);
  const share = (n: number) => (assigned ? Math.round((n / assigned) * 1000) / 10 : 0);
  const sorted = [...departments].filter((d) => d.users > 0).sort((a, b) => b.users - a.users);
  // Fold the tail only when it is 2+ departments; a single leftover keeps its own slice.
  const keep = sorted.length > MAX_SLICES + 1 ? sorted.slice(0, MAX_SLICES) : sorted;
  const rest = sorted.slice(keep.length);
  const slices: Slice[] = keep.map((d, i) => ({
    key: d.department_id,
    name: d.name,
    users: d.users,
    pro_users: d.pro_users,
    free_users: d.users - d.pro_users,
    share: share(d.users),
    color: `var(--series-${i + 1})`,
  }));
  if (rest.length) {
    const users = rest.reduce((sum, d) => sum + d.users, 0);
    const pro = rest.reduce((sum, d) => sum + d.pro_users, 0);
    slices.push({
      key: "other",
      name: `Other (${rest.length} departments)`,
      users,
      pro_users: pro,
      free_users: users - pro,
      share: share(users),
      color: OTHER_COLOR,
      members: rest.map((d) => `${d.name} · ${d.users}`),
    });
  }
  return slices;
}

function DepartmentTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Slice;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md max-w-[260px]">
      <p className="font-semibold text-sm mb-1">{d.name}</p>
      <p>
        <span className="font-bold">{d.users}</span> users ({d.share}% of users with a department)
      </p>
      <p>{d.pro_users} PRO · {d.free_users} free</p>
      {d.members && (
        <ul className="mt-1 border-t pt-1 text-muted-foreground">
          {d.members.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsersByDepartmentCard({ departments, withoutDepartment }: {
  departments: DepartmentCount[]; withoutDepartment: number;
}) {
  const slices = toSlices(departments);
  const total = slices.reduce((sum, s) => sum + s.users, 0);
  const [active, setActive] = useState<string | null>(null);

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Users per Department
        </CardTitle>
        <CardDescription>
          Each student counted once, by their main department. Hover a slice or a row for PRO / free details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(220px,300px)_1fr] items-center">
            <div className="relative mx-auto w-full max-w-[300px] aspect-square">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="users"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    isAnimationActive={false}
                    onMouseEnter={(_, i) => setActive(slices[i]?.key ?? null)}
                    onMouseLeave={() => setActive(null)}
                  >
                    {slices.map((s) => (
                      <Cell
                        key={s.key}
                        fill={s.color}
                        opacity={active && active !== s.key ? 0.35 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DepartmentTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Total in the middle of the donut */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold leading-none">{total}</span>
                <span className="text-xs text-muted-foreground mt-1">users</span>
              </div>
            </div>

            {/* Legend + exact numbers (also the readable version of the chart) */}
            <ul className="space-y-1 text-sm">
              {slices.map((s) => (
                <li
                  key={s.key}
                  title={s.members ? s.members.join("\n") : `${s.pro_users} PRO · ${s.free_users} free`}
                  onMouseEnter={() => setActive(s.key)}
                  onMouseLeave={() => setActive(null)}
                  className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors ${
                    active === s.key ? "bg-muted" : ""
                  }`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="font-semibold tabular-nums">{s.users}</span>
                  <span className="w-14 text-right text-muted-foreground tabular-nums">{s.share}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {withoutDepartment > 0 && (
          <p className="text-sm text-muted-foreground mt-3 border-t pt-3">
            <span className="font-semibold text-foreground">{withoutDepartment}</span> users started the bot but
            haven't chosen a department yet (not shown in the chart).
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { isSuperAdmin } = useAuth();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const resp = await api.get("/admin/stats/summary");
        setData(resp.data);
      } catch (err) {
        // toast.error is already handled or we can add it here if needed
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const growthLabel = data ? (
    <span className={`inline-flex items-center gap-1 ${data.user_growth_percent >= 0 ? "text-success" : "text-destructive"}`}>
      {data.user_growth_percent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(data.user_growth_percent)}% from last month
    </span>
  ) : null;

  const chartPoints = data?.chart_data.map(p => ({
    date: new Date(p.day).toLocaleDateString("en", { month: "short", day: "numeric" }),
    users: p.dau
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Real-time platform overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Users" 
          value={data?.total_users.toLocaleString() || "0"} 
          icon={<Users className="h-4 w-4" />} 
          description={growthLabel} 
        />
        <StatCard
          title="Completed Sessions"
          value={data?.total_exams.toLocaleString() || "0"}
          icon={<FileText className="h-4 w-4" />}
          description={
            data?.exam_sessions !== undefined
              ? `${data.exam_sessions.toLocaleString()} exams · ${(data.practice_sessions ?? 0).toLocaleString()} practice (all time)`
              : "Exams and practice sessions finished (all time)"
          }
        />
        <StatCard 
          title="Daily Active Users" 
          value={data?.today_dau.toLocaleString() || "0"} 
          icon={<Activity className="h-4 w-4" />} 
          description="Users active in the last 24h" 
        />
        <StatCard 
          title="Banned Users" 
          value={data?.banned_users.toLocaleString() || "0"} 
          icon={<Ban className="h-4 w-4" />} 
          description="Currently restricted accounts" 
        />
      </div>

      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base font-semibold">User Activity (Last 14 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorUsers)" 
                  strokeWidth={3} 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {data?.users_by_department && (
        <UsersByDepartmentCard
          departments={data.users_by_department}
          withoutDepartment={data.users_without_department ?? 0}
        />
      )}
    </div>
  );
}
