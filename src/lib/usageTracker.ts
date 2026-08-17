/**
 * Client-side Daily Usage Tracker.
 * Limits free users to 7 transcriptions per day (resets every midnight local time).
 */

const STORAGE_KEY = "scribe_daily_usage_v1";
export const DAILY_LIMIT = 7;

interface UsageData {
  date: string; // YYYY-MM-DD
  count: number;
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDailyUsageData(): UsageData {
  if (typeof window === "undefined") {
    return { date: getTodayString(), count: 0 };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const today = getTodayString();

    if (raw) {
      const parsed: UsageData = JSON.parse(raw);
      if (parsed.date === today) {
        return parsed;
      }
    }

    // Reset for new day
    const newData: UsageData = { date: today, count: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    return newData;
  } catch {
    return { date: getTodayString(), count: 0 };
  }
}

export function getDailyUsageCount(): number {
  return getDailyUsageData().count;
}

export function incrementDailyUsage(): number {
  if (typeof window === "undefined") return 1;

  try {
    const data = getDailyUsageData();
    data.count += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data.count;
  } catch {
    return 1;
  }
}

export function hasReachedDailyLimit(): boolean {
  return getDailyUsageCount() >= DAILY_LIMIT;
}
