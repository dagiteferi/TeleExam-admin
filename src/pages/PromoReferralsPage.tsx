import React, { useState, useEffect, useCallback } from "react";
import {
  Link2, Plus, Pencil, Trash2, RefreshCw, Copy, Check, X,
  Search, Users, Eye, EyeOff, ExternalLink, Save, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import axios from "axios";
import { getToken } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface PromoReferral {
  id: string;
  user_id: string;
  referrer_name: string;
  referrer_username: string | null;
  referrer_telegram_id: number | null;
  code: string;
  bot_link: string;
  welcome_message: string;
  is_active: boolean;
  click_count: number;
  created_at: string | null;
  updated_at: string | null;
}

interface UserResult {
  id: string;
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  telegram_username: string | null;
}

const DEFAULT_MESSAGE =
  "You'll get a special offer! Start exploring and make your Exit Exam preparation more effective with TeleExamAI!";

export default function PromoReferralsPage() {
  const [promos, setPromos] = useState<PromoReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoReferral | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create form state
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState(DEFAULT_MESSAGE);
  const [creating, setCreating] = useState(false);

  // Edit form state
  const [editMessage, setEditMessage] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const token = getToken();
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/promo-referrals`, authHeaders);
      setPromos(res.data);
    } catch {
      toast.error("Failed to load promo links");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPromos(); }, []);

  // User search
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) { setUserResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/users?search=${encodeURIComponent(query)}&limit=10`, authHeaders);
      setUserResults(
        res.data.map((u: any) => ({
          id: u.id || u.user_id,
          telegram_id: u.telegram_id,
          first_name: u.first_name,
          last_name: u.last_name,
          telegram_username: u.telegram_username,
        }))
      );
    } catch {
      setUserResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(userSearch), 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const handleCreate = async () => {
    if (!selectedUser) { toast.error("Please select a user"); return; }
    setCreating(true);
    try {
      await axios.post(`${API_BASE}/admin/promo-referrals`, {
        user_id: selectedUser.id,
        welcome_message: welcomeMessage,
      }, authHeaders);
      toast.success("Promo link created!");
      setShowCreate(false);
      setSelectedUser(null);
      setUserSearch("");
      setWelcomeMessage(DEFAULT_MESSAGE);
      fetchPromos();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create promo link");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPromo) return;
    setEditSaving(true);
    try {
      await axios.put(`${API_BASE}/admin/promo-referrals/${editingPromo.id}`, {
        welcome_message: editMessage,
      }, authHeaders);
      toast.success("Welcome message updated!");
      setEditingPromo(null);
      fetchPromos();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update");
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleActive = async (promo: PromoReferral) => {
    try {
      await axios.put(`${API_BASE}/admin/promo-referrals/${promo.id}`, {
        is_active: !promo.is_active,
      }, authHeaders);
      toast.success(promo.is_active ? "Promo link deactivated" : "Promo link activated");
      fetchPromos();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update");
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await axios.delete(`${API_BASE}/admin/promo-referrals/${deletingId}`, authHeaders);
      toast.success("Promo link deleted");
      setDeletingId(null);
      fetchPromos();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete");
    }
  };

  const copyLink = (promo: PromoReferral) => {
    navigator.clipboard.writeText(promo.bot_link);
    setCopiedId(promo.id);
    toast.success("Link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const displayName = (u: { first_name?: string | null; last_name?: string | null }) =>
    [u.first_name, u.last_name].filter(Boolean).join(" ") || "User";

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Link2 className="h-6 w-6" /> Promo Referral Links
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create special referral links for influencers. Users who join via these links see a personalized welcome message.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPromos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Link
          </Button>
        </div>
      </div>

      {/* How it works */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="py-4 px-5 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How it works:</p>
          <p>1. Select a user (influencer, YouTuber, group admin) and customize the welcome message</p>
          <p>2. Share the generated link with them — they share it in their group/channel</p>
          <p>3. The student who opens the link sees: <span className="text-foreground font-medium">"Welcome [their full name], you are coming from @referrer's referral! [your message]"</span></p>
          <p>4. The referral also counts towards the referrer's invite count (unlocking years/courses)</p>
        </CardContent>
      </Card>

      {/* Promo list */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : promos.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Link2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No promo links yet</p>
          <p className="text-sm mt-1">Create one to get started.</p>
          <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create First Link
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {promos.map((promo) => (
            <Card key={promo.id} className={`transition-all ${promo.is_active ? "hover:shadow-sm" : "opacity-60"}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {promo.referrer_name}
                      </span>
                      {promo.referrer_username && (
                        <span className="text-xs text-muted-foreground">@{promo.referrer_username}</span>
                      )}
                      {promo.is_active ? (
                        <Badge variant="secondary" className="text-xs text-green-600 bg-green-50 border-green-200">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                      )}
                      <Badge variant="outline" className="text-xs gap-1">
                        <Users className="h-3 w-3" /> {promo.click_count} click{promo.click_count !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Link */}
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all flex-1">
                        {promo.bot_link}
                      </code>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                        onClick={() => copyLink(promo)} title="Copy link">
                        {copiedId === promo.id ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>

                    {/* Welcome message preview */}
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Welcome message preview:</p>
                      <p className="text-xs text-foreground">
                        <strong>Welcome to TeleExamAI, [student's full name]!</strong><br />
                        We're glad to have you here!<br /><br />
                        🤝 You joined TeleExamAI through a special invitation from <strong>{promo.referrer_username ? `@${promo.referrer_username}` : promo.referrer_name}</strong><br />
                        🎁 <strong>A Special Offer Awaits You!</strong><br />
                        {promo.welcome_message}
                      </p>
                    </div>

                    {promo.created_at && (
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(promo.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => handleToggleActive(promo)}
                      title={promo.is_active ? "Deactivate" : "Activate"}>
                      {promo.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { setEditingPromo(promo); setEditMessage(promo.welcome_message); }}
                      title="Edit message">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(promo.id)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => {
        if (!o) { setShowCreate(false); setSelectedUser(null); setUserSearch(""); setUserResults([]); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Promo Referral Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* User search */}
            <div className="space-y-2">
              <Label>Select User (Influencer)</Label>
              {selectedUser ? (
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-semibold">{displayName(selectedUser)}</p>
                    {selectedUser.telegram_username && (
                      <p className="text-xs text-muted-foreground">@{selectedUser.telegram_username}</p>
                    )}
                    <p className="text-xs text-muted-foreground">ID: {selectedUser.telegram_id}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { setSelectedUser(null); setUserSearch(""); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, username, or Telegram ID..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchLoading && <p className="text-xs text-muted-foreground animate-pulse">Searching...</p>}
                  {userResults.length > 0 && (
                    <div className="rounded-lg border max-h-48 overflow-y-auto">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-b-0 transition-colors"
                          onClick={() => { setSelectedUser(u); setUserResults([]); setUserSearch(""); }}
                        >
                          <span className="font-medium">{displayName(u)}</span>
                          {u.telegram_username && (
                            <span className="text-muted-foreground ml-2">@{u.telegram_username}</span>
                          )}
                          <span className="text-muted-foreground ml-2 text-xs">({u.telegram_id})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Welcome message */}
            <div className="space-y-2">
              <Label htmlFor="welcome_msg">Welcome Message</Label>
              <p className="text-xs text-muted-foreground">
                This text appears after "Welcome [the student's full name], you are coming from @referrer's referral!" in the bot.
              </p>
              <Textarea
                id="welcome_msg"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="Enter the special welcome message..."
              />
            </div>

            {/* Preview */}
            {selectedUser && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">Bot message preview:</p>
                <p className="text-sm">
                  <strong>Welcome to TeleExamAI, [student's full name]!</strong><br />
                  We're glad to have you here!<br /><br />
                  🤝 You joined TeleExamAI through a special invitation from <strong>{selectedUser.telegram_username ? `@${selectedUser.telegram_username}` : displayName(selectedUser)}</strong><br />
                  🎁 <strong>A Special Offer Awaits You!</strong><br />
                  {welcomeMessage}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !selectedUser}>
              <Link2 className="h-4 w-4 mr-1" />{creating ? "Creating..." : "Create Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingPromo} onOpenChange={(o) => !o && setEditingPromo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Welcome Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">{editingPromo?.referrer_name}</p>
              {editingPromo?.referrer_username && (
                <p className="text-xs text-muted-foreground">@{editingPromo.referrer_username}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_msg">Welcome Message</Label>
              <Textarea
                id="edit_msg"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            {/* Preview */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">Preview:</p>
              <p className="text-sm">
                <strong>Welcome to TeleExamAI, [student's full name]!</strong><br />
                We're glad to have you here!<br /><br />
                🤝 You joined TeleExamAI through a special invitation from <strong>{editingPromo?.referrer_username ? `@${editingPromo.referrer_username}` : editingPromo?.referrer_name}</strong><br />
                🎁 <strong>A Special Offer Awaits You!</strong><br />
                {editMessage}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPromo(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={editSaving}>
              <Save className="h-4 w-4 mr-1" />{editSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promo Link</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this promo referral link. Users who already joined won't be affected, but the link will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
