import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Webhook, Plus, Trash2, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  is_active: boolean;
  created_at: string;
}

export default function Webhooks() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadWebhooks();
  }, []);

  async function checkAuthAndLoadWebhooks() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/login");
      return;
    }

    await loadWebhooks();
  }

  async function loadWebhooks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("webhook_endpoints")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setWebhooks(data);
    }
    setLoading(false);
  }

  async function addWebhook() {
    if (!newUrl) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL",
        variant: "destructive",
      });
      return;
    }

    // Generate webhook secret
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("webhook_endpoints")
      .insert({
        merchant_id: user.id,
        url: newUrl,
        secret,
        is_active: true,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add webhook endpoint",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Webhook endpoint added successfully",
      });
      setNewUrl("");
      setShowAddDialog(false);
      await loadWebhooks();
    }
  }

  async function deleteWebhook(id: string) {
    const { error } = await supabase
      .from("webhook_endpoints")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete webhook endpoint",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Webhook endpoint deleted successfully",
      });
      await loadWebhooks();
    }
    setDeletingWebhookId(null);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Webhooks</h1>
          <p className="text-muted-foreground">Configure webhook endpoints to receive transaction events</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      <div className="grid gap-4">
        {loading && webhooks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading webhooks...</p>
            </CardContent>
          </Card>
        ) : webhooks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Webhook className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No webhook endpoints configured</p>
              <Button onClick={() => setShowAddDialog(true)}>Add Your First Webhook</Button>
            </CardContent>
          </Card>
        ) : (
          webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Webhook className="h-5 w-5" />
                    <CardTitle className="text-lg">{webhook.url}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={webhook.is_active ? "default" : "secondary"}>
                      {webhook.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingWebhookId(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">Webhook Secret</Label>
                    <div className="flex gap-2 items-center mt-1">
                      <code className="flex-1 p-2 bg-muted rounded font-mono text-sm break-all">
                        {webhook.secret}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(webhook.secret, "Webhook secret")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Created: {new Date(webhook.created_at).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook Endpoint</DialogTitle>
            <DialogDescription>
              Enter the URL where you want to receive webhook notifications for transaction events.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                placeholder="https://your-domain.com/webhook"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addWebhook}>Add Webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingWebhookId} onOpenChange={() => setDeletingWebhookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the webhook endpoint.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingWebhookId && deleteWebhook(deletingWebhookId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
