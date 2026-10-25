import { test, expect, type Page } from '@playwright/test';

// Every visible link and button must be the top element at its own center,
// so nothing (e.g. the fixed hero globe canvas) swallows taps and clicks.

const pages = [
  { name: 'landing', path: '/', globe: true },
  { name: 'pricing', path: '/#/pricing', globe: false },
  { name: 'dashboard (guest)', path: '/#/dashboard', globe: false },
];

const TARGETS = 'a[href], button, [role="button"], input[type="submit"], input[type="button"]';

async function settle(page: Page) {
  // Landing page loader runs ~1.8s, then fades out.
  await page.waitForTimeout(2500);
}

for (const p of pages) {
  test(`hit targets: ${p.name}`, async ({ page }) => {
    await page.goto(p.path);
    await settle(page);

    if (p.globe) {
      // WebGL must be on, otherwise the canvas isn't rendered and the test proves nothing.
      await expect(page.locator('#hero canvas')).toHaveCount(1);
    }

    const count = await page.locator(TARGETS).count();
    const failures: string[] = [];
    const overlaps: string[] = [];
    let checked = 0;

    for (let i = 0; i < count; i++) {
      const result = await page.evaluate(
        async ({ sel, i }) => {
          const el = document.querySelectorAll<HTMLElement>(sel)[i];
          if (!el) return { skip: 'gone' };
          const visible =
            el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ??
            el.offsetParent !== null;
          if (!visible) return { skip: 'hidden' };
          if (getComputedStyle(el).pointerEvents === 'none') return { skip: 'pointer-events none' };
          el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return { skip: 'zero size' };
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          // Inside scroll-linked sticky/carousel sections some items can't be brought on screen.
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { skip: 'off screen' };
          const hits = (px: number, py: number) => {
            const t = document.elementFromPoint(px, py);
            return !!t && (t === el || el.contains(t));
          };
          const top = document.elementFromPoint(x, y);
          const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40);
          const hit = top ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 50)}` : 'nothing';
          if (hits(x, y)) return { ok: true, label, hit };
          // Neighbouring controls (e.g. close map dots) may overlap each other's edges.
          // That is reported, and passes only if part of the element is still reachable.
          const coveringControl = top?.closest(sel);
          if (coveringControl && coveringControl !== el) {
            for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) {
              if (hits(r.left + r.width * fx, r.top + r.height * fy)) return { ok: true, overlap: true, label, hit };
            }
          }
          return { ok: false, label, hit };
        },
        { sel: TARGETS, i },
      );
      if ('skip' in result) continue;
      checked++;
      if (!result.ok) failures.push(`"${result.label}" is covered by ${result.hit}`);
      else if (result.overlap) overlaps.push(`"${result.label}" center overlapped by ${result.hit}`);
    }

    if (overlaps.length) {
      test.info().annotations.push({ type: 'overlapping controls', description: overlaps.join('; ') });
      console.log(`[${test.info().project.name}] ${p.name}: overlapping controls: ${overlaps.join('; ')}`);
    }
    expect(checked, 'at least one target was checked').toBeGreaterThan(0);
    expect(failures, `${failures.length} of ${checked} targets covered`).toEqual([]);
  });
}
