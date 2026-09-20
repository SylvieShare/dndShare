import { expect, test, vi } from 'vitest';
import { sessionSteps } from './session';

for (const mobile of [false, true]) {
  test(`map tour only changes the DM interface (${mobile ? 'mobile' : 'desktop'})`, async () => {
    const target = vi.fn(),
      action = vi.fn(),
      showView = vi.fn();
    const options = { mobile, target, action, showView };
    const step = sessionSteps({ ...options, dm: true }).find((s) => s.id === 'map');
    expect(showView).not.toHaveBeenCalled();
    const context = { onCleanup: vi.fn() };
    await step.enter(context);
    expect(showView).toHaveBeenCalledWith('maps', context);
    step.target();
    expect(target).toHaveBeenCalledWith('session-content');
    expect(action).not.toHaveBeenCalled();
    expect(sessionSteps({ ...options, dm: false }).some((s) => s.id === 'map')).toBe(false);
  });
}
