import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { g12Api } from "../api";
import { Empty, Loading, PageHeader, useLoad, when } from "../components/kit";

interface Entry {
  id: number;
  admin: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
}

const short = (value: unknown) => (value === null || value === undefined ? "—" : JSON.stringify(value).slice(0, 160));

export default function G12AuditPage() {
  const { data, loading } = useLoad(async () => (await g12Api.get<{ items: Entry[] }>("/audit-log", { params: { limit: 200 } })).data.items);
  return (
    <>
      <PageHeader title="Audit Log" description="Every change made by an admin: who, when, before and after." />
      <Card>
        <CardContent className="p-0">
          {loading ? <Loading /> : !data?.length ? <Empty text="No changes yet." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Admin</TableHead><TableHead>Action</TableHead>
                <TableHead>Before</TableHead><TableHead>After</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{when(e.created_at)}</TableCell>
                    <TableCell>{e.admin ?? "system"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.action}</TableCell>
                    <TableCell className="font-mono text-xs max-w-xs truncate" title={JSON.stringify(e.before)}>{short(e.before)}</TableCell>
                    <TableCell className="font-mono text-xs max-w-xs truncate" title={JSON.stringify(e.after)}>{short(e.after)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
