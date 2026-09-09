import { test, expect } from '@playwright/test';

/**
 * 화면 E2E.
 * 알림 자동화가 조용히 망가지는 걸 막는 게 이 프로젝트의 요구사항이므로,
 * 화면과 API도 테스트로 지켜준다.
 */
test.describe('run-alert 화면', () => {
  test('목록이 렌더되고 필터가 동작한다', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'run-alert' })).toBeVisible();

    const list = page.getByTestId('item-list');
    await expect(list).toBeVisible();

    // 대회 탭
    await page.getByRole('button', { name: '대회' }).click();
    await expect(page.getByRole('button', { name: '대회' })).toHaveAttribute('aria-pressed', 'true');

    // 검색어를 넣으면 요청이 다시 나간다
    const req = page.waitForRequest((r) => r.url().includes('/api/items') && r.url().includes('q='));
    await page.locator('#q').fill('마라톤');
    await req;
  });

  test('health 엔드포인트가 응답한다', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('items');
  });
});
