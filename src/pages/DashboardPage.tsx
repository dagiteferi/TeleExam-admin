import { useEffect, useState } from "react";
import { Users, FileText, Activity, Ban, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

const shortName = (name: string) => (name.length > 26 ? `${name.slice(0, 25)}…` : name);

function DepartmentTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DepartmentCount & { free_users: number; share: number };
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-sm mb-1">{d.name}</p>
      <p><span className="font-bold">{d.users}</span> users ({d.share}% of users with a department)</p>
      <p className="text-primary">{d.pro_users} PRO</p>
      <p className="text-muted-foreground">{d.free_users} free</p>
    </div>
  );
}

function UsersByDepartmentCard({ departments, withoutDepartment }: {
  departments: DepartmentCount[]; withoutDepartment: number;
}) {
  const assigned = departments.reduce((sum, d) => sum + d.users, 0);
  const rows = departments.map((d) => ({
    ...d,
    free_users: d.users - d.pro_users,
    share: assigned ? Math.round((d.users / assigned) * 100) : 0,
  }));
  const height = Math.max(160, rows.length * 40 + 30);

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Users per Department
        </CardTitle>
        <CardDescription>
          Each student counted once, by their main department. Hover a bar for details.
        </CardDescription>
        <div className="flex flex-wrap gap-4 pt-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-primary/35" /> Free users
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-primary" /> PRO users
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments yet.</p>
        ) : (
          <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 48, top: 0, bottom: 0 }} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={190} axisLine={false} tickLine={false}
                  tickFormatter={shortName}
                  tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                <Tooltip content={<DepartmentTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <Bar dataKey="pro_users" stackId="u" fill="hsl(var(--primary))" radius={[4, 0, 0, 4]} />
                <Bar dataKey="free_users" stackId="u" fill="hsl(var(--primary) / 0.35)" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="users" position="right"
                    style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
