import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage, type SeoLandingContent } from "@/components/seo-landing-page";
import { SITE_NAME, SITE_URL } from "@/lib/seo/taxonomy";

const page: SeoLandingContent = {
  path: "/safe-random-video-chat",
  eyebrow: "Safety-first conversations",
  title: "Safe random video chat starts with clear boundaries",
  description: "Meetup is a free random video and text chat for adults 18+. Safety tools can help you respond to harmful behavior, but no online service can guarantee every interaction will be safe.",
  intro: "Meet new people from around the world while keeping control of what you share. Start a one-to-one chat, leave whenever you choose, and use reporting and blocking tools if a conversation crosses a line.",
  sections: [
    {
      heading: "Know what safety tools can and cannot do",
      paragraphs: [
        "Meetup is designed for adult conversations and includes an 18+ age gate, moderation measures, and ways to report or block someone. These tools support safer use; they are not a promise that every person or conversation will be appropriate.",
        "If you feel uncomfortable, end the chat rather than negotiating or sharing more information. Report behavior that breaks the rules so it can be reviewed. Read the Safety Center for the current community rules and response options.",
      ],
      bullets: ["Keep your full name, address, workplace, school, and contact details private.", "Do not send money, passwords, verification codes, or intimate images.", "Leave and report a conversation that includes threats, harassment, or unwanted sexual content.", "Use the service only if you are 18 or older."],
    },
    {
      heading: "A practical way to use random video chat",
      paragraphs: [
        "Before starting, choose a setting where you can end the conversation easily and avoid showing private details in the background. Keep personal documents, notifications, and location clues out of camera view.",
        "Start with ordinary topics and share only what you are comfortable making visible to a stranger. A friendly conversation is never a reason to reveal private information or move to another service under pressure.",
      ],
    },
    {
      heading: "Your choice, your pace",
      paragraphs: [
        "Random matching connects people who are available at the same time; it cannot pre-screen every personality or guarantee a particular kind of conversation. You can decide whether to continue, switch to text, or leave.",
        "For the platform's published rules and privacy information, visit the Safety Center and Privacy Policy. If there is immediate danger, contact local emergency services rather than relying on an online chat platform.",
      ],
    },
  ],
  faqs: [
    { question: "Is random video chat completely safe?", answer: "No platform can guarantee that every interaction is safe or prevent all harmful behavior. Use the available report and block tools, avoid sharing identifying details, and leave if anything feels wrong." },
    { question: "What should I do if someone behaves inappropriately?", answer: "End the conversation, use the report or block controls where available, and do not share personal information or agree to requests that make you uncomfortable." },
    { question: "Who can use Meetup random chat?", answer: "The service is for adults aged 18 and over. Do not use it if you are under 18." },
  ],
  safetyNote: "Video chat cannot prevent someone from using another device to record or photograph a screen. Never show or share anything you would not want copied. Meetup does not guarantee a risk-free interaction.",
};

export const Route = createFileRoute("/safe-random-video-chat")({
  head: () => ({
    meta: [
      { title: "Safe Random Video Chat for Adults — Meetup" },
      { name: "description", content: "Meet new people in a free 18+ random video chat with reporting, blocking, and moderation tools. Learn practical privacy boundaries before you start." },
      { property: "og:title", content: "Safe Random Video Chat for Adults — Meetup" },
      { property: "og:description", content: "Practical privacy guidance and safety tools for adults meeting people through random video chat." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}${page.path}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Safe Random Video Chat for Adults — Meetup" },
      { name: "twitter:description", content: "Practical privacy guidance and safety tools for adults meeting people through random video chat." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${page.path}` }],
  }),
  component: SafeRandomVideoChatPage,
});

function SafeRandomVideoChatPage() {
  return <SeoLandingPage page={page} />;
}