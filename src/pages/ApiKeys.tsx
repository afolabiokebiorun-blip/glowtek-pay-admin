import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, RotateCw, Trash2, Eye, EyeOff } from "lucide-react";
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

interface ApiKey {
  id: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function ApiKeys() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadKeys();
  }, []);

  async function checkAuthAndLoadKeys() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/login");
      return;
    }

    await loadKeys();
  }

  async function loadKeys() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("api-keys-list");
    
    if (!error && data) {
      setApiKeys(data.data || []);
    }
    setLoading(false);
  }

  async function createKey() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("api-keys-create");
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
    } else {
      setNewKey(data.data.apiKey);
      setShowNewKey(true);
      toast({
        title: "Success",
        description: "API key created successfully",
      });
      await loadKeys();
    }
    setLoading(false);
  }

  async function rotateKey(keyId: string) {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("api-keys-rotate", {
      body: { keyId },
    });
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to rotate API key",
        variant: "destructive",
      });
    } else {
      setNewKey(data.data.apiKey);
      setShowNewKey(true);
      toast({
        title: "Success",
        description: "API key rotated successfully",
      });
      await loadKeys();
    }
    setLoading(false);
    setRotatingKeyId(null);
  }

  async function revokeKey(keyId: string) {
    setLoading(true);
    const { error } = await supabase.functions.invoke("api-keys-revoke", {
      body: { keyId },
    });
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to revoke API key",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "API key revoked successfully",
      });
      await loadKeys();
    }
    setLoading(false);
    setRevokingKeyId(null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">API Keys</h1>
          <p className="text-muted-foreground">Manage your API keys for secure integration</p>
        </div>
        <Button onClick={createKey} disabled={loading}>
          <Key className="mr-2 h-4 w-4" />
          Create New Key
        </Button>
      </div>

      {newKey && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              New API Key Created
            </CardTitle>
            <CardDescription>
              Copy this key now. You won't be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-center p-4 bg-muted rounded-lg">
              <code className="flex-1 font-mono text-sm break-all">
                {showNewKey ? newKey : "••••••••••••••••••••••••••••••••"}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNewKey(!showNewKey)}
              >
                {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(newKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {loading && apiKeys.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading API keys...</p>
            </CardContent>
          </Card>
        ) : apiKeys.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No API keys yet</p>
              <Button onClick={createKey}>Create Your First API Key</Button>
            </CardContent>
          </Card>
        ) : (
          apiKeys.map((key) => (
            <Card key={key.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <code className="font-mono text-sm">
                        {key.key_prefix}••••••••••••••••
                      </code>
                      <Badge variant={key.is_active ? "default" : "secondary"}>
                        {key.is_active ? "Active" : "Revoked"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(key.created_at).toLocaleString()}
                      {key.last_used_at && (
                        <> • Last used: {new Date(key.last_used_at).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                  
                  {key.is_active && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRotatingKeyId(key.id)}
                        disabled={loading}
                      >
                        <RotateCw className="h-4 w-4 mr-2" />
                        Rotate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRevokingKeyId(key.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!rotatingKeyId} onOpenChange={() => setRotatingKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate the current key and generate a new one. Make sure to update your integration with the new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => rotatingKeyId && rotateKey(rotatingKeyId)}>
              Rotate Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!revokingKeyId} onOpenChange={() => setRevokingKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently revoke the API key and all requests using it will fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => revokingKeyId && revokeKey(revokingKeyId)}>
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
