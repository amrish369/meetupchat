import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Save,
  Sparkles,
  LogOut,
  Lock,
  Camera,
  ShieldCheck,
  Trash2,
  User,
  MapPin,
  BadgeCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { Separator } from "@/components/ui/separator";

import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, isPremiumActive } from "@/lib/auth";

const REGIONS = [
  "India",
  "South Asia",
  "Asia",
  "Europe",
  "Americas",
  "Africa",
  "Oceania",
];

const INTERESTS = [
  "AI",
  "Coding",
  "Gaming",
  "Music",
  "Fitness",
  "Anime",
  "Startups",
  "Travel",
  "Movies",
  "Photography",
];

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile — Meetup" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();

  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<string>("");
  const [region, setRegion] = useState<string>("");

  const [avatarUrl, setAvatarUrl] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
      setGender(profile.gender ?? "");
      setRegion(profile.region ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setInterests(profile.interests ?? []);
    }
  }, [profile]);

  const premium = isPremiumActive(profile);

  const completion = useMemo(() => {
    let score = 0;

    if (name) score += 20;
    if (username) score += 20;
    if (bio) score += 20;
    if (gender) score += 10;
    if (region) score += 10;
    if (avatarUrl) score += 10;
    if (interests.length > 0) score += 10;

    return score;
  }, [name, username, bio, gender, region, avatarUrl, interests]);

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item)
        ? prev.filter((x) => x !== item)
        : [...prev, item]
    );
  };

  const uploadAvatar = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      const file = e.target.files?.[0];

      if (!file) return;

      if (!file.type.startsWith("image/")) {
        return toast.error("Only image files are allowed");
      }

      if (file.size > 5 * 1024 * 1024) {
        return toast.error("Image must be under 5MB");
      }

      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) {
        setUploading(false);
        return toast.error(uploadError.message);
      }

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setAvatarUrl(data.publicUrl);

      toast.success("Avatar uploaded");
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    try {
      if (!user) return;

      if (username.includes(" ")) {
        return toast.error("Username cannot contain spaces");
      }

      if (bio.length > 160) {
        return toast.error("Bio too long");
      }

      setSaving(true);

      const { error } = await supabase.from("profiles").upsert({
        user_id: user.id,
        display_name: name || null,
        username: username || null,
        bio: bio || null,
        gender: gender || null,
        region: region || null,
        avatar_url: avatarUrl || null,
        interests: interests,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }

      toast.success("Profile updated successfully");

      await refreshProfile();
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const generateAIBio = () => {
    const bios = [
      "AI enthusiast building cool digital experiences.",
      "Love meaningful conversations and creative ideas.",
      "Tech + creativity + ambition 🚀",
      "Explorer of startups, coding, and good vibes.",
      "Always learning something new and exciting.",
    ];

    const randomBio =
      bios[Math.floor(Math.random() * bios.length)];

    setBio(randomBio);

    toast.success("AI bio generated");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">
          Loading profile...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Back */}
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </Link>

        {/* Header */}
        <div className="mt-6 rounded-3xl border border-border bg-card/70 backdrop-blur-xl p-6 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            {/* Avatar */}
            <div className="relative">
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-teal/30 bg-secondary">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 rounded-full bg-teal p-2 text-white shadow-lg transition hover:scale-105"
              >
                <Camera className="h-4 w-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={uploadAvatar}
              />
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold font-display">
                  {name || "Your profile"}
                </h1>

                {premium && (
                  <Badge className="bg-teal text-white">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Premium
                  </Badge>
                )}
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {user?.email}
              </p>

              <div className="mt-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span>Profile completion</span>
                  <span>{completion}%</span>
                </div>

                <Progress value={completion} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard title="Matches" value="24" />
          <StatCard title="Chats" value="12" />
          <StatCard title="Views" value="108" />
          <StatCard title="Completion" value={`${completion}%`} />
        </div>

        {/* Main Card */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft space-y-6">
          {/* Display Name */}
          <div>
            <Label>Display Name</Label>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              className="mt-2"
              maxLength={40}
            />
          </div>

          {/* Username */}
          <div>
            <Label>Username</Label>

            <Input
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "")
                )
              }
              placeholder="@username"
              className="mt-2"
              maxLength={20}
            />

            <p className="mt-1 text-xs text-muted-foreground">
              Only lowercase letters, numbers and underscore.
            </p>
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between">
              <Label>Bio</Label>

              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={generateAIBio}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI Bio
              </Button>
            </div>

            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself..."
              className="mt-2 min-h-[120px]"
              maxLength={160}
            />

            <div className="mt-1 text-right text-xs text-muted-foreground">
              {bio.length}/160
            </div>
          </div>

          {/* Gender + Region */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Gender</Label>

              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Region</Label>

              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>

                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Interests */}
          <div>
            <Label>Interests</Label>

            <div className="mt-3 flex flex-wrap gap-2">
              {INTERESTS.map((item) => {
                const active = interests.includes(item);

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleInterest(item)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? "border-teal bg-teal text-white"
                        : "border-border bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Premium */}
          {!premium && (
            <Link
              to="/premium"
              className="flex items-center justify-between rounded-3xl border border-teal/30 bg-teal/5 p-5 transition hover:border-teal/60"
            >
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <Lock className="h-4 w-4 text-teal" />
                  Upgrade to Premium
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Unlock advanced filters, AI matching & priority queue.
                </p>
              </div>

              <Sparkles className="h-5 w-5 text-teal" />
            </Link>
          )}

          {/* Save */}
          <Button
            onClick={save}
            disabled={saving}
            variant="hero"
            className="w-full h-12 text-base"
          >
            <Save className="mr-2 h-4 w-4" />

            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>

        {/* Privacy + Security */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-teal" />
            Privacy & Security
          </h2>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Verified account</p>
                <p className="text-sm text-muted-foreground">
                  Email verification enabled
                </p>
              </div>

              <Badge variant="secondary">
                <BadgeCheck className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Region visibility</p>
                <p className="text-sm text-muted-foreground">
                  Show your region publicly
                </p>
              </div>

              <Badge>Enabled</Badge>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="text-xl font-semibold text-red-400">
            Danger Zone
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Permanently delete your account and all data.
          </p>

          <Button
            variant="destructive"
            className="mt-4"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
        </div>

        {/* Sign Out */}
        <Button
          onClick={() =>
            signOut().then(() => navigate({ to: "/" }))
          }
          variant="ghost"
          className="mt-6 w-full text-muted-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>

      <Toaster richColors position="top-center" />
    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-sm text-muted-foreground">
        {title}
      </p>

      <p className="mt-1 text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}