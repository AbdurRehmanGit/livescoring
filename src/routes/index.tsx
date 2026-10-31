import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { History, Play, Radio } from "lucide-react";
import { NeuButton, PageShell } from "@/components/neu";
import { getState, resetMatch, useApp } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Scoring — Ball-by-ball cricket scorer" },
      { name: "description", content: "Start a cricket match, score every ball and keep a full match history." },
      { property: "og:title", content: "Live Scoring — Ball-by-ball cricket scorer" },
      { property: "og:description", content: "Start a cricket match, score every ball and keep a full match history." },
    ],
  }),
  component: Index,
});

function Index() {
  const nav = useNavigate();
  const app = useApp();
  const inProgress = !!app.setup && !app.savedMatchId;
  return (
    <PageShell className="flex flex-col items-center justify-center gap-10 pb-6">
      <div className="neu flex h-36 w-36 items-center justify-center rounded-full">
        <div className="neu-inset flex h-24 w-24 items-center justify-center rounded-full">
          <span className="h-12 w-12 rounded-full bg-gradient-primary glow-primary" />
        </div>
      </div>
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-glow text-primary">Live Scoring</h1>
        <p className="mt-3 text-muted-foreground">Ball-by-ball cricket scoring, in your pocket.</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-5">
        {inProgress && (
          <NeuButton variant="accent" size="lg" onClick={() => nav({ to: "/live" })}>
            <Radio className="h-5 w-5" /> Resume Match
          </NeuButton>
        )}
        <NeuButton
          variant="solid"
          size="lg"
          onClick={() => {
            if (getState().setup) resetMatch();
            nav({ to: "/setup" });
          }}
        >
          <Play className="h-5 w-5" /> Start a Match
        </NeuButton>
        <NeuButton variant="primary" size="lg" onClick={() => nav({ to: "/history" })}>
          <History className="h-5 w-5" /> Match History
        </NeuButton>
      </div>
    </PageShell>
  );
}
