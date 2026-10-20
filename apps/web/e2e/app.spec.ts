import { expect, test, type Page } from '@playwright/test';

const DEMO = { phone: '(11) 99999-0001', password: 'role-demo-2026' };
const shot = (page: Page, name: string, project: string) =>
  page.screenshot({ path: `e2e/screenshots/${project}-${name}.png`, fullPage: true });

/** Nada pode estourar a largura da tela: é o bug mais comum de layout em celular. */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(overflow.scroll, 'rolagem horizontal').toBeLessThanOrEqual(overflow.client + 1);
}

async function signIn(page: Page) {
  await page.goto('/entrar');
  await page.getByPlaceholder('(11) 99999-0000').fill(DEMO.phone);
  await page.locator('input[autocomplete$="-password"]').fill(DEMO.password);
  await page.getByRole('button', { name: /^entrar/i }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).first()).toBeVisible();
}

const problemsByPage = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  problemsByPage.set(page, problems);
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(m.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(problemsByPage.get(page)).toEqual([]);
});

test('tela de entrada abre sem estourar a largura', async ({ page }, info) => {
  await page.goto('/entrar');
  await expect(page.getByRole('tab', { name: 'Criar conta' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, 'login', info.project.name);
});

test('entra com a conta de demonstração e vê o feed', async ({ page }, info) => {
  await signIn(page);
  await expectNoHorizontalOverflow(page);

  const width = page.viewportSize()!.width;
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  // Desktop (lg, 1024+) usa o menu lateral; celular e tablet retrato usam a barra de baixo.
  if (width >= 1024) {
    const box = await nav.first().boundingBox();
    expect(box!.x).toBeLessThan(50);
    expect(box!.height).toBeGreaterThan(300);
  } else {
    const box = await nav.last().boundingBox();
    expect(box!.y).toBeGreaterThan(page.viewportSize()!.height / 2);
  }
  await shot(page, 'feed', info.project.name);
});

test('convite público e QG com todas as abas', async ({ page, request }, info) => {
  const login = await request.post('/api/auth/login', {
    data: { phone: DEMO.phone, password: DEMO.password },
  });
  expect(login.ok()).toBeTruthy();
  const events = (await (await request.get('/api/events')).json()) as {
    id: string;
    code: string;
    status: string;
  }[];
  const event = events.find((e) => e.status === 'confirmed') ?? events[0]!;

  // Convite visto por alguém sem conta.
  await page.goto(`/c/${event.code}`);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, 'convite', info.project.name);

  // QG logado.
  await signIn(page);
  await page.goto(`/role/${event.id}`);
  const tabs = page.getByRole('tablist', { name: 'Seções do QG' }).getByRole('tab');
  await expect(tabs.first()).toBeVisible();
  const count = await tabs.count();
  expect(count).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < count; i++) {
    await tabs.nth(i).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, `qg-aba-${i}`, info.project.name);
  }
});

test('cadastro mostra o código de recuperação', async ({ page }, info) => {
  await page.goto('/entrar');
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  const unique = `${Date.now()}`.slice(-8);
  await page.getByLabel('Como podemos te chamar?').fill('Pessoa de Teste');
  await page
    .getByPlaceholder('(11) 99999-0000')
    .fill(`(11) 9${unique.slice(0, 4)}-${unique.slice(4)}`);
  await page.locator('input[autocomplete$="-password"]').fill('uma-senha-bem-forte-2026');
  await page.getByRole('checkbox').check();
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText(/guarde seu código/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, 'codigo', info.project.name);
});

test('termos e privacidade abrem sem login', async ({ page }) => {
  for (const path of ['/termos', '/privacidade']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
