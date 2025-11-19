import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const [brandName, setBrandName] = useState("Glowtek Pay");
  const [primaryColor, setPrimaryColor] = useState("#4C1D95");
  const [logo, setLogo] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your site content has been updated successfully.",
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Site Content</h1>
        <p className="text-muted-foreground mt-1">Customize your brand identity and appearance</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Brand Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand Name</Label>
            <Input
              id="brandName"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Enter your brand name"
            />
            <p className="text-xs text-muted-foreground">
              This name will appear in the sidebar and throughout the dashboard.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <div className="flex items-center gap-4">
              <Input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#4C1D95"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Choose the primary color for your brand. This will affect buttons, links, and accents.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Logo Upload</Label>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                {logo ? (
                  <img src={logo} alt="Logo preview" className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <Upload className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Upload your brand logo. Recommended size: 256x256px (PNG or SVG)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-6 rounded-lg bg-primary flex items-center gap-4">
              {logo && (
                <div className="w-12 h-12 rounded-lg bg-white/10 p-2">
                  <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-primary-foreground">{brandName}</h3>
                <p className="text-xs text-primary-foreground/70">Admin Dashboard</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                style={{ backgroundColor: primaryColor }}
                className="text-white"
              >
                Primary Button
              </Button>
              <Button variant="outline">Secondary Button</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
