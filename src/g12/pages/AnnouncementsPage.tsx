import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, g12Api } from "../api";
import { Empty, Loading, PageHeader, StatusBadge, useLoad, when } from "../components/kit";

interface Announcement {
  id: string;
  preview: string;
  audience: string;
  stream: string | null;
  recipient_count: number;
  status: string;
  created_at: string;
  sent: number;
  failed: number;
}

const MAX = 4000;

export default function G12AnnouncementsPage() {
  const { data, loading, reload } = useLoad(async () => (await g12Api.get<Announcement[]>("/announcements")).data);
  const [text, setText] = useState("");
  const [audience, setAudience] = useState("all");
  const [stream, setStream] = useState("natural");
  const [telegramId, setTelegramId] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const body: Record<string, unknown> = { text: text.trim(), audience };
      if (audience === "stream") body.stream = stream;
      if (audience === "user") {
        const found = (await g12Api.get<{ items: { id: string; telegram_id: number }[] }>("/users", { params: { q: telegramId.trim(), limit: 5 } })).data.items
          .find((s) => String(s.telegram_id) === telegramId.trim());
        if (!found) throw new Error("No student with that Telegram ID.");
        body.user_id = found.id;
      }
      const { data: result } = await g12Api.post<{ recipients: number }>("/announcements", body);
      toast.success(`Queued for ${result.recipients} student(s). Sending runs in the background.`);
      setText("");
      reload();
    } catch (err) {
      toast.error(err instanceof Error && !("response" in err) ? err.message : errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const ready = text.trim().length > 0 && text.length <= MAX && (audience !== "user" || /^\d+$/.test(telegramId.trim()));

  return (
    <>
      <PageHeader title="Announcements" description="Send a message through the bot. Banned students are skipped." />
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">New announcement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write the message students will receive…" />
          <p className="text-xs text-muted-foreground">{text.length} / {MAX} characters</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label>Send to</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All students</SelectItem><SelectItem value="stream">One stream</SelectItem>
                  <SelectItem value="user">One student</SelectItem></SelectContent>
              </Select></div>
            {audience === "stream" && (
              <div className="space-y-1"><Label>Stream</Label>
                <Select value={stream} onValueChange={setStream}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="natural">Natural</SelectItem><SelectItem value="social">Social</SelectItem></SelectContent>
                </Select></div>
            )}
            {audience === "user" && (
              <div className="space-y-1"><Label>Telegram ID</Label>
                <Input className="w-48" value={telegramId} onChange={(e) => setTelegramId(e.target.value)} /></div>
            )}
            <Button disabled={!ready || sending} onClick={send}><Send className="h-4 w-4 mr-1" />Send</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {loading ? <Loading /> : !data?.length ? <Empty text="No announcements yet." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Message</TableHead><TableHead>To</TableHead><TableHead>Progress</TableHead>
                <TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-md">{a.preview}</TableCell>
                    <TableCell className="capitalize">{a.audience === "stream" ? a.stream : a.audience}</TableCell>
                    <TableCell className="w-48">
                      <Progress value={a.recipient_count ? ((a.sent + a.failed) / a.recipient_count) * 100 : 0} />
                      <p className="text-xs text-muted-foreground mt-1">{a.sent} sent · {a.failed} failed · {a.recipient_count} total</p>
                    </TableCell>
                    <TableCell><StatusBadge value={a.status} /></TableCell>
                    <TableCell>{when(a.created_at)}</TableCell>
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
