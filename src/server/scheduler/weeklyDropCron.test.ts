import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWeeklyDropCron } from './weeklyDropCron';

const mockGetActiveUserIds = vi.fn();
const mockGenerateWeeklyDropForUser = vi.fn();
const mockRecomputeUserPreferenceProfile = vi.fn();
const mockRecomputeWeeklyMetricsForWeek = vi.fn();

vi.mock('@/server/scheduler/activeUsers', () => ({
  getActiveUserIds: () => mockGetActiveUserIds(),
}));

vi.mock('@/server/services/generateWeeklyDrop', () => ({
  generateWeeklyDropForUser: (userId: string, opts: { weekStart?: Date }) =>
    mockGenerateWeeklyDropForUser(userId, opts),
  logGenerationStart: vi.fn(),
  logGenerationEnd: vi.fn(),
}));

vi.mock('@/server/services/recomputeUserProfile', () => ({
  recomputeUserPreferenceProfile: (userId: string, opts: { weekStart?: Date }) =>
    mockRecomputeUserPreferenceProfile(userId, opts),
}));

vi.mock('@/server/services/weeklyDropMetrics.service', () => ({
  recomputeWeeklyMetricsForWeek: (weekStart: Date, userIds: string[]) =>
    mockRecomputeWeeklyMetricsForWeek(weekStart, userIds),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActiveUserIds.mockResolvedValue(['user-a', 'user-b']);
  mockRecomputeUserPreferenceProfile
    .mockResolvedValueOnce({
      ok: true,
      userId: 'user-a',
      weekStart: '2026-03-02',
      processedFeedbackCount: 3,
      generatedSuppressions: 1,
    })
    .mockResolvedValueOnce({
      ok: true,
      userId: 'user-b',
      weekStart: '2026-03-02',
      processedFeedbackCount: 0,
      generatedSuppressions: 0,
    });
  mockGenerateWeeklyDropForUser
    .mockResolvedValueOnce({ ok: true, generated: true })
    .mockResolvedValueOnce({ ok: true, generated: false, reason: 'already_exists' });
  mockRecomputeWeeklyMetricsForWeek.mockResolvedValue(undefined);
});

describe('runWeeklyDropCron', () => {
  it('runs only for active users and reports generated vs skipped', async () => {
    const result = await runWeeklyDropCron();

    expect(mockGetActiveUserIds).toHaveBeenCalledTimes(1);
    expect(mockRecomputeUserPreferenceProfile).toHaveBeenCalledTimes(2);
    expect(mockGenerateWeeklyDropForUser).toHaveBeenCalledTimes(2);
    expect(mockRecomputeWeeklyMetricsForWeek).toHaveBeenCalledTimes(1);
    expect(result.activeUserCount).toBe(2);
    expect(result.generated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('counts failed when generation returns ok: false', async () => {
    mockGenerateWeeklyDropForUser
      .mockReset()
      .mockResolvedValueOnce({ ok: false, error: 'no_candidates' })
      .mockResolvedValueOnce({ ok: true, generated: true });

    const result = await runWeeklyDropCron();
    expect(result.failed).toBe(1);
    expect(result.generated).toBe(1);
  });

  it('recomputes profile before generating each user drop', async () => {
    await runWeeklyDropCron();
    const firstRecomputeOrder = mockRecomputeUserPreferenceProfile.mock.invocationCallOrder[0];
    const firstGenerateOrder = mockGenerateWeeklyDropForUser.mock.invocationCallOrder[0];
    expect(firstRecomputeOrder).toBeLessThan(firstGenerateOrder);
  });

  it('continues generation when a recompute fails', async () => {
    mockRecomputeUserPreferenceProfile
      .mockReset()
      .mockResolvedValueOnce({
        ok: false,
        userId: 'user-a',
        weekStart: '2026-03-02',
        processedFeedbackCount: 0,
        generatedSuppressions: 0,
        error: 'db timeout',
      })
      .mockResolvedValueOnce({
        ok: true,
        userId: 'user-b',
        weekStart: '2026-03-02',
        processedFeedbackCount: 1,
        generatedSuppressions: 0,
      });

    const result = await runWeeklyDropCron();
    expect(mockGenerateWeeklyDropForUser).toHaveBeenCalledTimes(2);
    expect(result.activeUserCount).toBe(2);
  });
});
