import Dexie, { type Table } from "dexie";
import { AttemptLog, UserProfile } from "@/types/phonetics";

class TingLiDatabase extends Dexie {
  profiles!: Table<UserProfile, string>;
  attempts!: Table<AttemptLog, string>;

  constructor() {
    super("TingLiLabDB");
    this.version(1).stores({
      profiles: "id, name, lastActiveDate",
      attempts: "id, profileId, timestamp, mode, category, subCategory",
    });
  }
}

export const db = typeof window !== "undefined" ? new TingLiDatabase() : null;

const PROFILES_STORAGE_KEY = "tingli_lab_profiles_v1";
const ACTIVE_PROFILE_ID_KEY = "tingli_lab_active_profile_id_v1";
const ATTEMPTS_STORAGE_KEY = "tingli_lab_recent_attempts_v1";

export function createDefaultProfile(
  name: string = "Estudante Principal",
  avatarColor: string = "#9E2A2B",
  id?: string
): UserProfile {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: id || `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    avatarColor,
    preferredLang: "pt",
    preferredScript: "simplified",
    blindModeDefault: true,
    createdAt: Date.now(),
    xp: 0,
    streakDays: 1,
    lastActiveDate: today,
    diagnosticCompleted: false,
    radarScores: {
      tonesMonosyllable: 65,
      tonesDissyllable: 60,
      aspirationContrast: 62,
      retroflexPalatal: 58,
      nasalCodas: 64,
      umlautVowels: 60,
    },
    confusion: {
      monosyllableTones: {},
      dissyllableTones: {},
      contrastStats: {},
    },
    fsrsCards: {},
  };
}

export function loadProfilesSync(): {
  profiles: UserProfile[];
  activeProfile: UserProfile;
} {
  if (typeof window === "undefined") {
    const def = createDefaultProfile("Você (Admin)", "#9E2A2B", "default_user");
    return { profiles: [def], activeProfile: def };
  }

  try {
    const raw = window.localStorage.getItem(PROFILES_STORAGE_KEY);
    let profiles: UserProfile[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(profiles) || profiles.length === 0) {
      const p1 = createDefaultProfile("Você (Principal)", "#9E2A2B", "default_user");
      const p2 = createDefaultProfile("Amigo / Parceiro", "#3A6B59", "friend_user");
      profiles = [p1, p2];
      window.localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    }

    const activeId = window.localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
    const activeProfile =
      profiles.find((p) => p.id === activeId) || profiles[0];
    return { profiles, activeProfile };
  } catch {
    const def = createDefaultProfile("Você (Principal)", "#9E2A2B", "default_user");
    return { profiles: [def], activeProfile: def };
  }
}

export async function saveProfileState(
  updatedProfile: UserProfile,
  allProfiles?: UserProfile[]
): Promise<UserProfile[]> {
  if (typeof window === "undefined") return [updatedProfile];

  const current = allProfiles || loadProfilesSync().profiles;
  const exists = current.some((p) => p.id === updatedProfile.id);
  const nextProfiles = exists
    ? current.map((p) => (p.id === updatedProfile.id ? updatedProfile : p))
    : [...current, updatedProfile];

  window.localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));
  window.localStorage.setItem(ACTIVE_PROFILE_ID_KEY, updatedProfile.id);

  if (db) {
    try {
      await db.profiles.put(updatedProfile);
    } catch {
      // fallback to localStorage already completed
    }
  }
  return nextProfiles;
}

export async function logAttemptToStorage(attempt: AttemptLog): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    const list: AttemptLog[] = raw ? JSON.parse(raw) : [];
    const next = [attempt, ...list].slice(0, 500);
    window.localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }

  if (db) {
    try {
      await db.attempts.put(attempt);
    } catch {
      // ignore
    }
  }
}

export function loadRecentAttemptsSync(profileId?: string): AttemptLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    const list: AttemptLog[] = raw ? JSON.parse(raw) : [];
    if (!profileId) return list;
    return list.filter((a) => a.profileId === profileId);
  } catch {
    return [];
  }
}

export function exportUserDataJSON(): string {
  const { profiles, activeProfile } = loadProfilesSync();
  const attempts = loadRecentAttemptsSync();
  return JSON.stringify(
    {
      app: "TīngLì Lab (听力实验室)",
      exportedAt: new Date().toISOString(),
      activeProfileId: activeProfile.id,
      profiles,
      attempts,
    },
    null,
    2
  );
}

export function importUserDataJSON(jsonStr: string): {
  ok: boolean;
  message: string;
  profiles?: UserProfile[];
} {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
      return { ok: false, message: "Formato JSON inválido: lista de perfis ausente." };
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        PROFILES_STORAGE_KEY,
        JSON.stringify(parsed.profiles)
      );
      if (parsed.activeProfileId) {
        window.localStorage.setItem(ACTIVE_PROFILE_ID_KEY, parsed.activeProfileId);
      }
      if (Array.isArray(parsed.attempts)) {
        window.localStorage.setItem(
          ATTEMPTS_STORAGE_KEY,
          JSON.stringify(parsed.attempts.slice(0, 500))
        );
      }
    }
    return {
      ok: true,
      message: `${parsed.profiles.length} perfil(is) importado(s) com sucesso!`,
      profiles: parsed.profiles,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Erro ao processar arquivo JSON: ${(err as Error).message}`,
    };
  }
}
