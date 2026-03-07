import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWeeklyDropCron } from './weeklyDropCron';

const mockGetActiveUserIds = vi.fn();
const mockGenerateWeeklyDropForUser = vi.fn();

vi.mock('@/server/scheduler/activeUsers', () => ({
  getActiveUserIds: () => mockGetActiveUserIds(),
}));

vi.mock('@/server/services/generateWeeklyDrop', () => ({
  generateWeeklyDropForUser: (userId: string, opts: { weekStart?: Date }) =>
    mockGenerateWeeklyDropForUser(userId, opts),
  logGenerationStart: vi.fn(),
  logGenerationEnd: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActiveUserIds.mockResolvedValue(['user-a', 'user-b']);
  mockGenerateWeeklyDropForUser
    .mockResolvedValueOnce({ ok: true, generated: true })
    .mockResolvedValueOnce({ ok: true, generated: false, reason: 'already_exists' });
});

describe('runWeeklyDropCron', () => {
  it('runs only for active users and reports generated vs skipped', async () => {
    const result = await runWeeklyDropCron();

    expect(mockGetActiveUserIds).toHaveBeenCalledTimes(1);
    expect(mockGenerateWeeklyDropForUser).toHaveBeenCalledTimes(2);
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
});
