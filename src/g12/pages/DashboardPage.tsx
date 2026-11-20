import { Activity, BookOpen, CreditCard, Crown, Database, FileWarning, PenLine, Users } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const number = (value: number | string) => Number(value).toLocaleString();

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
      <PageHeader title="Grade 12 Dashboard" description="Students, payments, study activity and content at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Students" value={number(d.users.total)} icon={<Users className="h-4 w-4" />}
                  description={`${number(d.users.natural)} Natural · ${number(d.users.social)} Social`} />
        <StatCard title="Active today" value={number(d.users.active_today)} icon={<Activity className="h-4 w-4" />}
                  description={`${number(d.users.active_7d)} in the last 7 days · ${number(d.users.new_today)} new today`} />
        <StatCard title="PRO students" value={number(d.pro_users)} icon={<Crown className="h-4 w-4" />}
                  description={`Revenue: ${number(d.revenue)} ETB`} />
        <StatCard title="Pending payments" value={number(d.pending_payments)} icon={<CreditCard className="h-4 w-4" />}
                  description="Receipts waiting for review" />
        <StatCard title="Answered today" value={number(d.study.answered_today)} icon={<PenLine className="h-4 w-4" />}
                  description={`${number(d.study.exams_today)} exams today · ${number(d.study.active_sessions)} running now`} />
        <StatCard title="Ready questions" value={number(d.content.ready_questions)} icon={<BookOpen className="h-4 w-4" />}
                  description={`${number(d.content.hidden_questions)} hidden`} />
        <StatCard title="Open reports" value={number(d.content.open_reports)} icon={<FileWarning className="h-4 w-4" />}
                  description="Problems reported by students" />
        <StatCard title="Database size" value={`${(d.db_bytes / 1024 / 1024).toFixed(0)} MB`}
                  icon={<Database className="h-4 w-4" />} description="Supabase free plan: 500 MB" />
      </div>
      {health && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Service health</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <span className="flex items-center gap-2">Overall <StatusBadge value={health.status} /></span>
            <span className="flex items-center gap-2">Database <StatusBadge value={health.db.status} /></span>
            <span className="flex items-center gap-2">Redis <StatusBadge value={health.redis.status} /></span>
            <span className="flex items-center gap-2">File storage <StatusBadge value={health.storage.status} /></span>
          </CardContent>
        </Card>
      )}
    </>
  );
}
