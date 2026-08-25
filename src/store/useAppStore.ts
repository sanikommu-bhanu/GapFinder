"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isPremium?: boolean;
  streakDays?: number;
}

interface AppState {
  user: SessionUser | null;
  isDemoMode: boolean;
  activeAnalysisId: string | null;
  activeGapId: string | null;
  onboardingSubjects: string[];
  onboardingLevel: string | null;
  setUser: (user: SessionUser | null) => void;
  setDemoMode: (on: boolean) => void;
  setActiveAnalysis: (id: string | null) => void;
  setActiveGap: (id: string | null) => void;
  setOnboarding: (subjects: string[], level: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isDemoMode: false,
      activeAnalysisId: null,
      activeGapId: null,
      onboardingSubjects: [],
      onboardingLevel: null,
      setUser: (user) => set({ user }),
      setDemoMode: (on) => set({ isDemoMode: on }),
      setActiveAnalysis: (id) => set({ activeAnalysisId: id }),
      setActiveGap: (id) => set({ activeGapId: id }),
      setOnboarding: (subjects, level) => set({ onboardingSubjects: subjects, onboardingLevel: level }),
      reset: () => set({ user: null, isDemoMode: false, activeAnalysisId: null, activeGapId: null }),
    }),
    { name: "gapfinder-store" }
  )
);
