import { Injectable } from '@nestjs/common';

// 5 minutes: long enough that GET /tasks/meta (hit on every single
// Dashboard/Tasks page load - see the Dashboard.tsx/useTasksPage.ts
// waterfall fix) stops round-tripping to the DB for identical data almost
// every time, short enough that even a missed invalidation (a bug, or a
// write path that doesn't go through TaskTypesService for some reason)
// self-heals within minutes instead of serving stale data indefinitely.
const META_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Why in-memory instead of Redis: this app runs as a single Render
 * instance today (no evidence of horizontal scaling, no shared-state
 * requirement across processes) - Redis exists to share a cache across
 * MULTIPLE app instances, which is a problem this app doesn't have yet.
 * Adding Redis now would mean a new paid add-on (or a separate free-tier
 * service like Upstash to wire up and monitor) purely to solve a
 * single-process cache-invalidation problem that a plain in-memory Map
 * already solves for free, with less to break.
 *
 * If/when this app runs as more than one instance (Render's paid tiers
 * support horizontal scaling), this exact interface (get/set/invalidate)
 * is what you'd swap the internals of for a Redis-backed version -
 * nothing calling TaskMetaCacheService would need to change.
 */
@Injectable()
export class TaskMetaCacheService {
  private cached: { data: unknown; expiresAt: number } | null = null;

  get<T>(): T | null {
    if (!this.cached || this.cached.expiresAt < Date.now()) {
      return null;
    }
    return this.cached.data as T;
  }

  set<T>(data: T): void {
    this.cached = { data, expiresAt: Date.now() + META_CACHE_TTL_MS };
  }

  /** Called by TaskTypesService after any create/update/deactivate. */
  invalidate(): void {
    this.cached = null;
  }
}
