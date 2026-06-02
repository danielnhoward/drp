// Pure runner-matching algorithm. Deliberately has NO `import "server-only"`
// (like gender.ts / format-date.ts): it touches neither the database nor
// cookies, so it can be unit-tested directly and reused on either side of the
// server boundary. The DB read/write that feeds and persists it lives in
// lib/runs.ts (recomputeRuns).

/** Largest group we'll put into a single run. */
export const MAX_GROUP_SIZE = 4;

/** A run's distance may differ from a member's by at most this ratio. */
const DISTANCE_RATIO_LIMIT = 1.2; // within ±20%

const EARTH_RADIUS_KM = 6371;

/** An availability slot, tagged with the user it belongs to. */
export type MatchableAvailability = {
  userId: number;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  /** Window start, "HH:MM". */
  startTime: string;
  /** Window end, "HH:MM". */
  endTime: string;
  distanceKm: number;
  /** Fastest pace, seconds per km. */
  paceMinSeconds: number;
  /** Slowest pace, seconds per km. */
  paceMaxSeconds: number;
  lat: number;
  lon: number;
};

/** A run the algorithm proposes for a compatible group, ready to persist. */
export type ProposedRun = {
  date: string;
  /** Start time, "HH:MM" — midpoint of the group's shared time window. */
  time: string;
  /** Mean of members' distances, to one decimal place. */
  distanceKm: number;
  /** Centroid of members' locations. */
  lat: number;
  lon: number;
  /** Formatted centroid coordinates, used as the meeting-point label. */
  meetAt: string;
  /** Members, in input order. */
  userIds: number[];
};

/** Minutes since midnight for an "HH:MM" string. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** "HH:MM" for a minutes-since-midnight value, rounded to the nearest minute. */
export function minutesToTime(minutes: number): string {
  const total = Math.round(minutes);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Great-circle distance between two lat/lon points, in kilometres. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Arithmetic mean of a set of points — the group's meeting point. */
export function centroid(
  points: ReadonlyArray<{ lat: number; lon: number }>,
): { lat: number; lon: number } {
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
  return { lat, lon };
}

/** A coordinate label like "51.50730, -0.16570". */
export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

// Whether every distance in the set is within ±20% of every other — i.e. the
// largest is at most DISTANCE_RATIO_LIMIT × the smallest.
function distancesCompatible(distances: number[]): boolean {
  const min = Math.min(...distances);
  const max = Math.max(...distances);
  if (min <= 0) return max === min; // guard non-positive input
  return max / min <= DISTANCE_RATIO_LIMIT;
}

/**
 * Whether a set of slots can run together: 2–{@link MAX_GROUP_SIZE} people on
 * the same date, with a non-empty shared time window, a non-empty shared pace
 * range, and distances within ±20%. For intervals/ratios on a single axis,
 * pairwise compatibility implies whole-set compatibility, so this doubles as the
 * pairwise check (see {@link areCompatible}).
 */
export function isValidGroup(members: MatchableAvailability[]): boolean {
  if (members.length < 2 || members.length > MAX_GROUP_SIZE) return false;

  // Distinct people only — a user can't run with their own other slots.
  const userIds = members.map((m) => m.userId);
  if (new Set(userIds).size !== userIds.length) return false;

  const date = members[0].date;
  if (!members.every((m) => m.date === date)) return false;

  // Shared time window: latest start must come strictly before earliest end.
  const startMax = Math.max(...members.map((m) => timeToMinutes(m.startTime)));
  const endMin = Math.min(...members.map((m) => timeToMinutes(m.endTime)));
  if (startMax >= endMin) return false;

  // Shared pace range: highest floor must not exceed lowest ceiling.
  const paceLow = Math.max(...members.map((m) => m.paceMinSeconds));
  const paceHigh = Math.min(...members.map((m) => m.paceMaxSeconds));
  if (paceLow > paceHigh) return false;

  return distancesCompatible(members.map((m) => m.distanceKm));
}

/** Whether two slots are compatible (a valid group of two). */
export function areCompatible(
  a: MatchableAvailability,
  b: MatchableAvailability,
): boolean {
  return isValidGroup([a, b]);
}

/** Mean distance each member travels from their location to the group centroid. */
export function meanTravelKm(members: MatchableAvailability[]): number {
  const c = centroid(members);
  const total = members.reduce(
    (sum, m) => sum + haversineKm(m.lat, m.lon, c.lat, c.lon),
    0,
  );
  return total / members.length;
}

// Builds the persistable run for a chosen group.
function buildRun(members: MatchableAvailability[]): ProposedRun {
  const startMax = Math.max(...members.map((m) => timeToMinutes(m.startTime)));
  const endMin = Math.min(...members.map((m) => timeToMinutes(m.endTime)));
  const c = centroid(members);
  const meanDistance =
    members.reduce((sum, m) => sum + m.distanceKm, 0) / members.length;

  return {
    date: members[0].date,
    time: minutesToTime((startMax + endMin) / 2),
    distanceKm: Math.round(meanDistance * 10) / 10,
    lat: c.lat,
    lon: c.lon,
    meetAt: formatCoords(c.lat, c.lon),
    userIds: members.map((m) => m.userId),
  };
}

// Yields every index combination of size minSize..maxSize over [0, n).
function* combinations(
  n: number,
  minSize: number,
  maxSize: number,
): Generator<number[]> {
  const combo: number[] = [];
  function* recurse(start: number): Generator<number[]> {
    if (combo.length >= minSize) yield [...combo];
    if (combo.length === maxSize) return;
    for (let i = start; i < n; i++) {
      combo.push(i);
      yield* recurse(i + 1);
      combo.pop();
    }
  }
  yield* recurse(0);
}

// Partitions one date's slots into runs. Brute force (acceptable per spec — the
// pools are small): enumerate every partition into valid groups (plus unmatched
// singletons) and keep the one that matches the most people, then minimises the
// total mean travel distance. Returns the chosen groups (each size 2–4).
function partitionByDate(
  items: MatchableAvailability[],
): MatchableAvailability[][] {
  const n = items.length;

  // Valid candidate groups, bucketed by their smallest member index: the search
  // only ever extends the first uncovered item, whose index is that bucket key.
  const candidatesByMin: number[][][] = Array.from({ length: n }, () => []);
  for (const combo of combinations(n, 2, MAX_GROUP_SIZE)) {
    if (isValidGroup(combo.map((i) => items[i]))) {
      candidatesByMin[combo[0]].push(combo);
    }
  }

  const covered = new Array<boolean>(n).fill(false);
  const current: number[][] = [];
  // Held on an object rather than a plain `let`: the closures below mutate it,
  // and TS doesn't track such mutations when narrowing a captured `let`.
  type Best = { groups: number[][]; matched: number; travel: number };
  const state: { best: Best | null } = { best: null };

  const firstUncovered = (): number => {
    for (let i = 0; i < n; i++) {
      if (!covered[i]) return i;
    }
    return -1;
  };

  const evaluate = (): void => {
    let matched = 0;
    let travel = 0;
    for (const group of current) {
      const members = group.map((i) => items[i]);
      matched += members.length;
      // Total of every member's travel. With `matched` fixed across the
      // partitions we compare, minimising this total is equivalent to
      // minimising the mean distance each person travels.
      travel += meanTravelKm(members) * members.length;
    }
    const best = state.best;
    if (
      best === null ||
      matched > best.matched ||
      (matched === best.matched && travel < best.travel - 1e-9)
    ) {
      state.best = { groups: current.map((g) => [...g]), matched, travel };
    }
  };

  const search = (): void => {
    const i = firstUncovered();
    if (i === -1) {
      evaluate();
      return;
    }
    // Option 1: leave i unmatched (a solo runner gets no run).
    covered[i] = true;
    search();
    covered[i] = false;
    // Option 2: place i in one of the candidate groups anchored at it.
    for (const group of candidatesByMin[i]) {
      if (group.every((idx) => !covered[idx])) {
        for (const idx of group) covered[idx] = true;
        current.push(group);
        search();
        current.pop();
        for (const idx of group) covered[idx] = false;
      }
    }
  };

  search();
  const best = state.best;
  if (best === null) return [];
  return best.groups.map((group) => group.map((i) => items[i]));
}

/**
 * Groups compatible availability slots into runs of at most
 * {@link MAX_GROUP_SIZE}. Slots are matched only within the same date; see
 * {@link isValidGroup} for the compatibility rules and {@link partitionByDate}
 * for the objective (maximise matches, then minimise mean travel distance).
 */
export function computeRuns(
  availabilities: MatchableAvailability[],
): ProposedRun[] {
  const byDate = new Map<string, MatchableAvailability[]>();
  for (const a of availabilities) {
    let list = byDate.get(a.date);
    if (!list) {
      list = [];
      byDate.set(a.date, list);
    }
    // At most one slot per user per date: keeps a user from being matched with
    // their own other slots or booked into two runs at the same time. The first
    // slot for that date wins.
    if (list.some((existing) => existing.userId === a.userId)) continue;
    list.push(a);
  }

  const runs: ProposedRun[] = [];
  for (const date of [...byDate.keys()].sort()) {
    for (const group of partitionByDate(byDate.get(date) ?? [])) {
      runs.push(buildRun(group));
    }
  }
  return runs;
}
