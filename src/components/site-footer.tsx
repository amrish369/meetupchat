import { Link } from "@tanstack/react-router";
import { Shield, Instagram, Linkedin } from "lucide-react"; // Icons add kiye

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-deep text-cream/85">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-1">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-cream">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal text-white">
              <Shield className="h-4 w-4" />
            </span>
            Meetup
          </Link>
          <p className="mt-4 text-sm text-cream/65">
            India ka safest anonymous video chat. No tracking.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-cream">Product</h4>
          <ul className="space-y-2 text-sm text-cream/70">
            <li><Link to="/chat" className="hover:text-cream">Start chat</Link></li>
            <li><Link to="/pricing" className="hover:text-cream">Pricing</Link></li>
            <li><Link to="/safety" className="hover:text-cream">Safety center</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-cream">Company</h4>
          <ul className="space-y-2 text-sm text-cream/70">
            <li><Link to="/about" className="hover:text-cream">About us</Link></li>
            <li><a href="mailto:hello@meetup.app" className="hover:text-cream">Contact</a></li>
          </ul>
        </div>

        {/* Naya Social Section */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-cream">Connect</h4>
          <div className="flex gap-4">
            <a href="https://www.instagram.com/_www.compressdocument.in" target="_blank" rel="noreferrer" className="text-cream/70 hover:text-teal transition-colors">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="https://www.linkedin.com/in/amrish-yadav-673b963b5" target="_blank" rel="noreferrer" className="text-cream/70 hover:text-teal transition-colors">
              <Linkedin className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-cream/55 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Meetup. Made in India 🇮🇳</p>
          <p>You must be 18+ to use Meetup.</p>
        </div>
      </div>
    </footer>
  );
}
