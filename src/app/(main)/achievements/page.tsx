"use client";
import { useEffect, useState } from "react";
import { Award, Target, Shuffle, MessageCircle, Flame, Trophy } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Achievement = { id: string; title: string; description: string; icon: string; unlocked: boolean };

const ICONS: Record<string, any> = {
  target: Target,
  award: Award,
  shuffle: Shuffle,
  "message-circle": MessageCircle,
  flame: Flame,
};

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((d) => setAchievements(d.achievements ?? []));
  }, []);

  return (
    <div className="pb-6">
      <TopBar title="Achievements" back={false} />
      <div className="grid grid-cols-2 gap-3 px-5">
        {achievements.map((a) => {
          const Icon = ICONS[a.icon] ?? Trophy;
          return (
            <Card key={a.id} className={cn("flex flex-col items-center gap-2 text-center", !a.unlocked && "opacity-40")}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand">
                <Icon className="h-6 w-6 text-white" />
              </span>
              <p className="text-sm font-semibold text-navy-900">{a.title}</p>
              <p className="text-[11px] text-ink-soft">{a.description}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
