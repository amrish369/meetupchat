import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage, type SeoLandingContent } from "@/components/seo-landing-page";
import { SITE_URL } from "@/lib/seo/taxonomy";

const page: SeoLandingContent = {
  path: "/random-video-chat-worldwide",
  eyebrow: "A wider conversation",
  title: "Random video chat with people around the world",
  description: "Meetup brings adults together for one-to-one random video or text conversations across borders. Start when you are ready, and remember that matches depend on who is online and on your connection.",
  intro: "Say hello beyond your usual circle. Meetup is a worldwide place to meet people through spontaneous video and text chat—without needing a phone number or email to begin random chat.",
  sections: [
    {
      heading: "Meet across time zones",
      paragraphs: [
        "A global random chat is shaped by the people online at that moment. You may meet someone with a different first language, routine, or perspective; you may also need to wait for an available match. The platform does not guarantee a particular country, language, or response time.",
        "Keep expectations open and treat the person on screen with the same respect you would expect in return. If conversation flows, ask simple questions and give each other time to understand accents or language differences.",
      ],
      bullets: ["Use clear, respectful language and ask before changing topics.", "Be patient when audio, video, or network quality varies.", "Do not assume another person's location or identity from a profile or accent.", "Leave or report behavior that breaks the community rules."],
    },
    {
      heading: "Video or text—choose how to begin",
      paragraphs: [
        "Video can make a first hello feel more personal, while text can be a comfortable way to start when you are somewhere noisy or have limited bandwidth. The available experience depends on your device, browser permissions, network, and the match.",
        "You do not need to share your phone number or email to begin random chat. Keep conversations on the service unless you independently decide otherwise, and do not share passwords, payment details, or one-time codes with a stranger.",
      ],
    },
    {
      heading: "Global access, with adult-only community rules",
      paragraphs: [
        "Meetup is for people aged 18 and older. A worldwide audience does not mean every country or network will have the same availability; local restrictions and connection quality may vary.",
        "The Safety Center explains how to report and block behavior that violates the rules. Being online with someone does not make them known or verified, so use good judgment and protect your personal details in every conversation.",
      ],
    },
  ],
  faqs: [
    { question: "Can I choose which country my random match is from?", answer: "Random matching does not guarantee a person from a particular country. Premium filters may offer region preferences, but availability and match results are not guaranteed." },
    { question: "Does global video chat work everywhere?", answer: "Access and call quality depend on local availability, your browser, device, network, and whether another person is online. The service cannot promise uninterrupted calls in every location." },
    { question: "Do I need a phone number to meet people worldwide?", answer: "A phone number or email is not required to begin random chat. Avoid sharing identifying or sensitive details with people you have just met." },
  ],
  safetyNote: "Worldwide matching is not identity verification. Never send money, passwords, verification codes, or personal documents to someone you meet in a random chat.",
};

export const Route = createFileRoute("/random-video-chat-worldwide")({
  head: () => ({
    meta: [
      { title: "Worldwide Random Video Chat — Meet People Globally | Meetup" },
      { name: "description", content: "Start a free worldwide random video or text chat for adults 18+. Meet people across borders, with realistic guidance on availability, privacy, and connection quality." },
      { property: "og:title", content: "Worldwide Random Video Chat — Meetup" },
      { property: "og:description", content: "Meet people around the world through spontaneous adult video and text chat." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}${page.path}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Worldwide Random Video Chat — Meetup" },
      { name: "twitter:description", content: "Meet people around the world through spontaneous adult video and text chat." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${page.path}` }],
  }),
  component: WorldwideRandomVideoChatPage,
});

function WorldwideRandomVideoChatPage() {
  return <SeoLandingPage page={page} />;
}