import { createFileRoute } from "@tanstack/react-router";
import { SeoLandingPage, type SeoLandingContent } from "@/components/seo-landing-page";
import { SITE_URL } from "@/lib/seo/taxonomy";

const page: SeoLandingContent = {
  path: "/anonymous-video-chat",
  eyebrow: "Chat without a public profile",
  title: "Anonymous video chat, with privacy in your hands",
  description: "Start a random video or text conversation without entering a phone number or email. Learn what anonymous chat means—and why you should still protect personal details.",
  intro: "Meet someone new without building a public profile first. Random chat on Meetup does not ask for your phone number or email to get started, so you can focus on the conversation and choose what you share.",
  sections: [
    {
      heading: "What anonymous means here",
      paragraphs: [
        "Anonymous chat means you can begin a random conversation without providing a phone number or email address. It does not mean a stranger is verified, that every interaction is private from people nearby, or that the internet can make you impossible to identify.",
        "Your camera background, voice, name badges, notifications, and the details you mention can reveal more than you intend. Review what is visible before starting and avoid saying where you live, work, or study.",
      ],
      bullets: ["Keep full names, handles from other services, and contact details to yourself.", "Turn off visible notifications and move personal documents out of view.", "Never share passwords, payment information, or one-time login codes.", "Use report, block, and leave controls when something feels wrong."],
    },
    {
      heading: "No sign-up for the first hello",
      paragraphs: [
        "You can begin a random chat without creating a public-facing profile or entering your email or phone number. The service may request permissions such as camera or microphone access so video and audio can work; you can choose text when you do not want to enable those permissions.",
        "Private messaging, following, or other account features may have separate sign-in requirements. A no-sign-up random chat should not be confused with every feature on the platform being account-free.",
      ],
    },
    {
      heading: "Make privacy part of the conversation",
      paragraphs: [
        "You control what you say and show. Do not let another person pressure you to reveal personal information, move to a different service, or share photos or financial details. A stranger can claim to be anyone, so treat identity and location claims with care.",
        "The service is for adults aged 18 and older. Review the Privacy Policy and Safety Center to understand the platform's policies and the tools available during a conversation.",
      ],
    },
  ],
  faqs: [
    { question: "Can I start a random chat without email or phone?", answer: "Yes. A phone number or email is not needed to begin random chat. Some separate account features may require sign-in." },
    { question: "Does anonymous chat make me impossible to identify?", answer: "No. People may recognize your face or voice, or infer details from your surroundings and what you say. Avoid showing or sharing anything that identifies you." },
    { question: "Do I have to turn on my camera?", answer: "Camera and microphone permissions are needed for video and audio. If you do not want to enable them, use text chat where available or do not start a video conversation." },
  ],
  safetyNote: "Anonymous does not mean risk-free or untraceable. Protect identifying details, be cautious with links and requests, and leave a conversation if you feel pressured.",
};

export const Route = createFileRoute("/anonymous-video-chat")({
  head: () => ({
    meta: [
      { title: "Anonymous Video Chat Without Phone or Email — Meetup" },
      { name: "description", content: "Start random video or text chat without providing a phone number or email. Understand what anonymous chat does—and does not—mean for your privacy." },
      { property: "og:title", content: "Anonymous Video Chat Without Phone or Email — Meetup" },
      { property: "og:description", content: "Meet new people without a public profile, and keep control of what personal details you share." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}${page.path}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Anonymous Video Chat — Meetup" },
      { name: "twitter:description", content: "Meet new people without a public profile, and keep control of what personal details you share." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${page.path}` }],
  }),
  component: AnonymousVideoChatPage,
});

function AnonymousVideoChatPage() {
  return <SeoLandingPage page={page} />;
}