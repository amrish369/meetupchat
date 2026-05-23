import { createFileRoute, Link } from "@tanstack/react-router";
import { Server, Shield, Network, KeyRound, Terminal, Globe, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/coturn-setup")({
  head: () => ({
    meta: [
      { title: "Self-host Coturn (TURN server) for India — Meetup" },
      {
        name: "description",
        content:
          "Step-by-step Coturn setup guide for Indian WebRTC apps: turnserver.conf, firewall ports, ephemeral credentials, Jio/Airtel NAT tuning, TLS on 443.",
      },
      { property: "og:title", content: "Coturn setup for Indian WebRTC — Meetup" },
      {
        property: "og:description",
        content:
          "Production-grade TURN server setup tuned for Indian mobile carriers. Open source, ~₹500/month.",
      },
    ],
  }),
  component: CoturnSetupPage,
});

function CoturnSetupPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-wider text-teal">
            Engineering · Networking
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Self-host Coturn for India
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            A production-grade TURN setup that survives Jio CGNAT, Airtel symmetric
            NAT, and corporate Wi-Fi firewalls. Open source. Around ₹500/month on a
            small VPS.
          </p>
        </header>

        <Note
          icon={AlertTriangle}
          title="Why you need this"
          body="STUN-only works for ~70-80% of users on home Wi-Fi. On Indian mobile
              networks (Jio, Airtel 4G/5G) most users sit behind carrier-grade
              NAT, so direct P2P fails and the call shows a black screen. A TURN
              server relays the media as a fallback."
        />

        <Section icon={Server} title="1. Pick a VPS close to your users" step="Step 1">
          <p>
            Latency &gt; bandwidth for video. Pick a region with &lt; 80ms RTT to
            most Indian users. Good options:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              <strong>Mumbai (ap-south-1)</strong> — AWS Lightsail, DigitalOcean
              BLR1, Hetzner (no India region — skip), Linode Mumbai.
            </li>
            <li>
              <strong>Singapore</strong> — fallback if Mumbai is sold out.
              30-50ms from India.
            </li>
            <li>
              <strong>Specs:</strong> 2 vCPU / 2 GB RAM / 4 TB transfer is enough
              for ~200 concurrent relayed calls. Roughly ₹500-700/month.
            </li>
          </ul>
        </Section>

        <Section icon={Globe} title="2. Point a DNS A-record" step="Step 2">
          <p>
            Create <code className="rounded bg-muted px-1.5 py-0.5">turn.yourdomain.com</code>{" "}
            → <em>your VPS public IPv4</em>. (IPv6 is fine to add too but not all
            Indian ISPs support it cleanly yet.) Wait for propagation
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5">dig +short turn.yourdomain.com</code>.
          </p>
        </Section>

        <Section icon={Terminal} title="3. Install Coturn" step="Step 3">
          <p>On Ubuntu 22.04 / Debian 12:</p>
          <Code>{`sudo apt update
sudo apt install -y coturn certbot
# Allow coturn to start as a service
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn`}</Code>
        </Section>

        <Section icon={Shield} title="4. Get a TLS cert (for turns:// on 443)" step="Step 4">
          <p>
            <code className="rounded bg-muted px-1.5 py-0.5">turns://</code> on
            port <strong>443</strong> is the single most important thing for
            India — it tunnels through corporate Wi-Fi, public hotspots, and
            mobile DPI that block UDP / non-standard ports.
          </p>
          <Code>{`sudo certbot certonly --standalone -d turn.yourdomain.com
# Cert lives at /etc/letsencrypt/live/turn.yourdomain.com/{fullchain,privkey}.pem
# Allow coturn to read it:
sudo usermod -a -G ssl-cert turnserver
sudo chmod 750 /etc/letsencrypt/{live,archive}
sudo chgrp ssl-cert /etc/letsencrypt/live/turn.yourdomain.com/privkey.pem`}</Code>
        </Section>

        <Section icon={KeyRound} title="5. Generate a strong shared secret" step="Step 5">
          <p>
            This is the same secret your app uses to mint short-lived
            credentials. Keep it out of git.
          </p>
          <Code>{`openssl rand -hex 32
# → e.g. 7e2a...c91d   (copy this — you'll paste it into both turnserver.conf
#                       and your Lovable Cloud secret TURN_SHARED_SECRET)`}</Code>
        </Section>

        <Section icon={Server} title="6. /etc/turnserver.conf" step="Step 6">
          <p>
            Replace <code className="rounded bg-muted px-1.5 py-0.5">YOUR_PUBLIC_IP</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">turn.yourdomain.com</code>, and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">YOUR_SECRET</code>:
          </p>
          <Code>{`# === Network ===
listening-port=3478
tls-listening-port=5349
# Also listen on 443 — critical for Indian corporate / cafe Wi-Fi
alt-tls-listening-port=443
listening-ip=0.0.0.0
external-ip=YOUR_PUBLIC_IP
relay-ip=YOUR_PUBLIC_IP

# === Auth: ephemeral REST credentials (matches src/lib/turn.functions.ts) ===
use-auth-secret
static-auth-secret=YOUR_SECRET
realm=turn.yourdomain.com

# === TLS ===
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
cipher-list="ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM"
no-tlsv1
no-tlsv1_1

# === Hardening ===
no-cli
no-multicast-peers
no-loopback-peers
# Block private/link-local destinations so the relay isn't abused as an
# open proxy into your VPC or AWS metadata:
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
denied-peer-ip=::1-::1
denied-peer-ip=fe80::-feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
allowed-peer-ip=YOUR_PUBLIC_IP

# === Tuning for Indian mobile carriers ===
# Jio/Airtel often drop long-idle UDP. Keep the relay alive:
stale-nonce=600
# Cap per-user bandwidth so one abuser can't saturate the pipe (kbps):
max-bps=1500000
total-quota=400
user-quota=12

# === Logs ===
log-file=/var/log/turn.log
simple-log
verbose`}</Code>
        </Section>

        <Section icon={Network} title="7. Open the firewall" step="Step 7">
          <p>UFW on Ubuntu / cloud security group rules:</p>
          <Code>{`sudo ufw allow 3478/udp     comment 'STUN/TURN UDP'
sudo ufw allow 3478/tcp     comment 'STUN/TURN TCP'
sudo ufw allow 5349/tcp     comment 'TURN over TLS'
sudo ufw allow 443/tcp      comment 'TURN over TLS on 443 (carrier bypass)'
# Coturn allocates UDP relays from this range; open it on the cloud SG too:
sudo ufw allow 49152:65535/udp comment 'TURN relay range'`}</Code>
          <p className="mt-3 text-sm text-muted-foreground">
            On AWS / GCP / Azure: replicate the same rules in the security
            group, otherwise UFW alone won't help.
          </p>
        </Section>

        <Section icon={Terminal} title="8. Start it & verify" step="Step 8">
          <Code>{`sudo systemctl enable --now coturn
sudo systemctl status coturn
sudo tail -f /var/log/turn.log

# From your laptop, check the public-facing port:
nc -uvz turn.yourdomain.com 3478
openssl s_client -connect turn.yourdomain.com:443 -servername turn.yourdomain.com

# Browser test:
# Open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
# Add: turn:turn.yourdomain.com:3478?transport=udp
#      turns:turn.yourdomain.com:443?transport=tcp
# Use a username/credential pair from your /api/turn endpoint.
# You should see 'relay' candidates in the candidate list.`}</Code>
        </Section>

        <Section icon={KeyRound} title="9. Wire it into Meetup" step="Step 9">
          <p>
            Add these secrets in <strong>Lovable Cloud → Connectors → Secrets</strong>{" "}
            (the app's <code className="rounded bg-muted px-1.5 py-0.5">getTurnCredentials</code>{" "}
            server function reads them at runtime):
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">TURN_SHARED_SECRET</code>{" "}
              — same value as <code>static-auth-secret</code> in turnserver.conf
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">TURN_URLS</code> —
              comma-separated, in priority order:
              <Code small>{`turn:turn.yourdomain.com:3478?transport=udp,turn:turn.yourdomain.com:3478?transport=tcp,turns:turn.yourdomain.com:443?transport=tcp`}</Code>
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">TURN_TTL_SECONDS</code>{" "}
              — optional, default <code>3600</code>. Shorter = safer if a
              credential leaks; longer = fewer round-trips.
            </li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Once set, the app issues fresh credentials per session via HMAC-SHA1
            (Coturn's REST API mode). Rotating the secret invalidates all
            in-flight credentials within their TTL — no client deploy needed.
          </p>
        </Section>

        <Section icon={Shield} title="10. Operations checklist" step="Step 10">
          <ul className="space-y-2">
            <li>
              <strong>Renew TLS:</strong> <code className="rounded bg-muted px-1.5 py-0.5">certbot renew</code>{" "}
              cron + <code>systemctl reload coturn</code> post-hook.
            </li>
            <li>
              <strong>Monitor bandwidth:</strong>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">vnstat -i eth0</code>.
              Each relayed 480p call ≈ 0.5 Mbps × 2 = 1 Mbps total.
            </li>
            <li>
              <strong>Rotate secret quarterly:</strong> generate a new one,
              update <code>turnserver.conf</code> + Lovable Cloud secret, then
              reload Coturn. Old credentials expire within their TTL.
            </li>
            <li>
              <strong>Abuse monitoring:</strong> watch{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">/var/log/turn.log</code>{" "}
              for unusual relay traffic to non-WebRTC ports — adjust{" "}
              <code>denied-peer-ip</code> if needed.
            </li>
          </ul>
        </Section>

        <div className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">That's it.</h2>
          <p className="mt-2 text-muted-foreground">
            Once Coturn is up and the secrets are wired, the chat client
            automatically picks up TURN credentials, and any user whose first
            ICE attempt fails is silently retried over relay — no UI work
            required.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="hero">
              <Link to="/chat">Test it on /chat</Link>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://github.com/coturn/coturn/wiki"
                target="_blank"
                rel="noreferrer"
              >
                Coturn wiki
              </a>
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  step,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  step: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-border pt-8">
      <div className="flex items-start gap-4">
        <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-grad text-white shadow-soft">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {step}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <div className="prose-meetup mt-3 text-sm leading-relaxed text-foreground/90 sm:text-base">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function Code({ children, small }: { children: string; small?: boolean }) {
  return (
    <pre
      className={`mt-3 overflow-x-auto rounded-lg border border-border bg-deep p-4 font-mono text-cream ${
        small ? "text-[11px]" : "text-xs sm:text-[13px]"
      } leading-relaxed`}
    >
      <code>{children}</code>
    </pre>
  );
}

function Note({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="mb-6 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
      <Icon className="h-5 w-5 shrink-0 text-destructive" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
