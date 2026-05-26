import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useEffect, useMemo, useState } from "react";

import {
  Shield,
  Mail,
  Lock,
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  Globe,
  Zap,
  ShieldCheck,
  Loader2,
  UserPlus,
} from "lucide-react";

import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { Badge } from "@/components/ui/badge";

import { Progress } from "@/components/ui/progress";

import { Separator } from "@/components/ui/separator";

import { Toaster } from "@/components/ui/sonner";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      {
        title: "Sign In — Meetup",
      },

      {
        name: "description",
        content:
          "Sign in to Meetup and unlock private rooms, AI-powered matching, premium filters, and secure anonymous video chat.",
      },

      {
        property: "og:title",
        content: "Meetup Login",
      },

      {
        property: "og:description",
        content:
          "Join Meetup for anonymous and secure random video chat with premium matching features.",
      },
    ],
  }),

  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [strength, setStrength] = useState(0);

  useEffect(() => {
    if (user) {
      navigate({ to: "/chat" });
    }
  }, [user, navigate]);

  useEffect(() => {
    calculatePasswordStrength(password);
  }, [password]);

  const calculatePasswordStrength = (pw: string) => {
    let score = 0;

    if (pw.length >= 6) score += 25;
    if (pw.length >= 10) score += 25;
    if (/[A-Z]/.test(pw)) score += 25;
    if (/[0-9]/.test(pw)) score += 25;

    setStrength(score);
  };

  const strengthLabel = useMemo(() => {
    if (strength <= 25) return "Weak";
    if (strength <= 50) return "Medium";
    if (strength <= 75) return "Strong";

    return "Very strong";
  }, [strength]);

  const onGoogle = async () => {
    try {
      setBusy(true);

      const res =
        await lovable.auth.signInWithOAuth(
          "google",
          {
            redirect_uri:
              window.location.origin + "/chat",
          }
        );

      if (res.error) {
        toast.error(
          res.error.message ||
            "Google authentication failed"
        );
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onEmailLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      setBusy(true);

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        return toast.error(error.message);
      }

      toast.success("Welcome back!");

      navigate({ to: "/chat" });
    } catch (err) {
      toast.error("Login failed");
    } finally {
      setBusy(false);
    }
  };

  const onEmailSignup = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      setBusy(true);

      if (password.length < 6) {
        return toast.error(
          "Password must be at least 6 characters"
        );
      }

      const { error } =
        await supabase.auth.signUp({
          email,
          password,

          options: {
            emailRedirectTo:
              `${window.location.origin}/chat`,
          },
        });

      if (error) {
        return toast.error(error.message);
      }

      toast.success(
        "Account created successfully!"
      );

      setEmail("");
      setPassword("");
    } catch (err) {
      toast.error("Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,200,0.12),transparent_45%)]" />

      {/* GRID */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="h-full w-full bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        {/* LEFT */}
        <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-14">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>

            <Badge className="mt-8 border border-teal/20 bg-teal/10 text-teal">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Privacy-first random video chat
            </Badge>

            <h1 className="mt-6 max-w-xl text-5xl font-bold leading-tight text-foreground">
              Meet people.
              <span className="block bg-gradient-to-r from-teal to-cyan-400 bg-clip-text text-transparent">
                Stay anonymous.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Join Meetup to unlock private rooms,
              AI-powered matching, premium filters,
              secure profiles, and smarter connections.
            </p>

            {/* FEATURES */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Feature
                icon={Shield}
                title="Anonymous chat"
                text="No real identity required"
              />

              <Feature
                icon={Globe}
                title="Global matching"
                text="Connect worldwide instantly"
              />

              <Feature
                icon={Zap}
                title="Realtime pairing"
                text="Ultra-fast smart matching"
              />

              <Feature
                icon={Sparkles}
                title="Premium filters"
                text="Better control & discovery"
              />
            </div>
          </motion.div>
        </div>

        {/* RIGHT */}
        <div className="flex w-full items-center justify-center px-6 py-12 lg:max-w-lg lg:px-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="w-full rounded-[32px] border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-2xl"
          >
            {/* LOGO */}
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-grad text-white shadow-xl">
                <Shield className="h-7 w-7" />
              </div>

              <h2 className="mt-5 text-3xl font-bold">
                Welcome to Meetup
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Secure sign in for smarter matching
              </p>
            </div>

            {/* GOOGLE */}
            <Button
              onClick={onGoogle}
              disabled={busy}
              variant="outline"
              size="lg"
              className="mt-8 h-12 w-full rounded-2xl"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg
                  className="mr-2 h-5 w-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                  />
                </svg>
              )}

              Continue with Google
            </Button>

            {/* DIVIDER */}
            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />

              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                OR
              </span>

              <Separator className="flex-1" />
            </div>

            {/* TABS */}
            <Tabs defaultValue="signin">
              <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl">
                <TabsTrigger value="signin">
                  Sign in
                </TabsTrigger>

                <TabsTrigger value="signup">
                  Create account
                </TabsTrigger>
              </TabsList>

              {/* SIGN IN */}
              <TabsContent value="signin">
                <form
                  onSubmit={onEmailLogin}
                  className="mt-6 space-y-5"
                >
                  <Field
                    id="login-email"
                    label="Email"
                    icon={
                      <Mail className="h-4 w-4" />
                    }
                    value={email}
                    onChange={setEmail}
                    type="email"
                    placeholder="you@example.com"
                    required
                  />

                  <PasswordField
                    id="login-password"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    showPassword={showPassword}
                    setShowPassword={
                      setShowPassword
                    }
                  />

                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-muted-foreground">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                      />

                      Remember me
                    </label>

                    <button
                      type="button"
                      className="text-teal hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    variant="hero"
                    className="h-12 w-full rounded-2xl"
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}

                    Sign in securely
                  </Button>
                </form>
              </TabsContent>

              {/* SIGNUP */}
              <TabsContent value="signup">
                <form
                  onSubmit={onEmailSignup}
                  className="mt-6 space-y-5"
                >
                  <Field
                    id="signup-email"
                    label="Email"
                    icon={
                      <Mail className="h-4 w-4" />
                    }
                    value={email}
                    onChange={setEmail}
                    type="email"
                    placeholder="you@example.com"
                    required
                  />

                  <PasswordField
                    id="signup-password"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    showPassword={showPassword}
                    setShowPassword={
                      setShowPassword
                    }
                  />

                  {/* PASSWORD STRENGTH */}
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Password strength
                      </span>

                      <span className="font-medium text-foreground">
                        {strengthLabel}
                      </span>
                    </div>

                    <Progress value={strength} />
                  </div>

                  {/* CHECKLIST */}
                  <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-4">
                    <Checklist
                      ok={password.length >= 6}
                      text="Minimum 6 characters"
                    />

                    <Checklist
                      ok={/[A-Z]/.test(password)}
                      text="One uppercase letter"
                    />

                    <Checklist
                      ok={/[0-9]/.test(password)}
                      text="One number"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    variant="hero"
                    className="h-12 w-full rounded-2xl"
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}

                    Create secure account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* FOOTER */}
            <div className="mt-8 rounded-2xl border border-teal/20 bg-teal/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-teal" />

                <div>
                  <p className="text-sm font-medium text-foreground">
                    Privacy-first authentication
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Meetup never shares your personal
                    data publicly. Authentication is
                    encrypted and securely managed
                    using Supabase Auth.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
              You can still use random chat without
              creating an account. Login is only
              required for premium features, saved
              profiles, and advanced matching.
            </p>
          </motion.div>
        </div>
      </div>

      <Toaster
        richColors
        position="top-center"
      />
    </div>
  );
}

/* FIELD */
function Field({
  id,
  label,
  icon,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "id"
>) {
  return (
    <div>
      <Label
        htmlFor={id}
        className="text-xs font-medium"
      >
        {label}
      </Label>

      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>

        <Input
          id={id}
          value={value}
          onChange={(e) =>
            onChange(e.target.value)
          }
          className="h-12 rounded-2xl pl-11"
          {...rest}
        />
      </div>
    </div>
  );
}

/* PASSWORD FIELD */
function PasswordField({
  id,
  label,
  value,
  onChange,
  showPassword,
  setShowPassword,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (
    value: boolean
  ) => void;
}) {
  return (
    <div>
      <Label
        htmlFor={id}
        className="text-xs font-medium"
      >
        {label}
      </Label>

      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Lock className="h-4 w-4" />
        </span>

        <Input
          id={id}
          value={value}
          onChange={(e) =>
            onChange(e.target.value)
          }
          type={
            showPassword
              ? "text"
              : "password"
          }
          className="h-12 rounded-2xl pl-11 pr-11"
          placeholder="Enter password"
          required
        />

        <button
          type="button"
          onClick={() =>
            setShowPassword(!showPassword)
          }
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

/* FEATURE */
function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: any;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal/10 text-teal">
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="mt-4 font-semibold text-foreground">
        {title}
      </h3>

      <p className="mt-1 text-sm text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

/* CHECKLIST */
function Checklist({
  ok,
  text,
}: {
  ok: boolean;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2
        className={`h-4 w-4 ${
          ok
            ? "text-teal"
            : "text-muted-foreground"
        }`}
      />

      <span
        className={
          ok
            ? "text-foreground"
            : "text-muted-foreground"
        }
      >
        {text}
      </span>
    </div>
  );
}