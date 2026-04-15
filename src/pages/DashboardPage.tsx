import { useEffect, useState } from "react";
import { Users, FileText, Activity, Ban, TrendingUp, TrendingDown } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryData {
  total_users: number;
  user_growth_percent: number;
  total_exams: number;
  today_dau: number;
  banned_users: number;
  chart_data: Array<{ day: string; dau: number }>;
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
        console.error("Failed to fetch summary:", err);
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
          title="Total Exams" 
          value={data?.total_exams.toLocaleString() || "0"} 
          icon={<FileText className="h-4 w-4" />} 
          description="Completed exams (Mode: Exam)" 
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
    </div>
  );
}
