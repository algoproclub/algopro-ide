import {
  chromium,
  devices,
  Browser,
  BrowserContext,
  Response,
} from 'playwright';
import { readFile } from 'fs/promises';

let browser: Browser;

async function withContext<T>(fn: (context: BrowserContext) => Promise<T>) {
  const context = await browser.newContext(devices['Desktop Chrome']);
  const result = await fn(context);
  await context.close();
  return result;
}

async function login(username: string, password: string) {
  return withContext(async context => {
    const page = await context.newPage();
    let resp: Response | null;
    await page.goto('https://codeforces.com/enter?back=%2F');
    await page.fill('input[name="handleOrEmail"]', username);
    await page.fill('input[name="password"]', password);
    await page.check('input[name="remember"]');
    console.log('Logging in as ' + username);
    await page.click('input[type="submit"]');
    await page.waitForURL('https://codeforces.com/');

    const session = (await context.cookies('https://codeforces.com')).find(
      c => c.name === 'JSESSIONID'
    )?.value;
    if (!session) throw new Error('Session cookie not found');
    do {
      resp = await page.goto('https://codeforces.com/problemset/submit');
    } while (resp?.status() !== 200);
    const csrf_token = await page
      .locator('.submit-form input[name="csrf_token"]')
      .getAttribute('value');
    if (!csrf_token) throw new Error('CSRF token not found');
    console.log('Logged in as ' + username);
    return { session, csrf_token };
  });
}

(async () => {
  browser = await chromium.launch();

  if (process.argv.length !== 3) {
    console.error('Usage: yarn run login <accounts.json>');
    process.exit(1);
  }
  const accounts: [string, string][] = JSON.parse(
    await readFile(process.argv[2], { encoding: 'utf-8' })
  );
  const accountInfos = [];
  for (const [username, password] of accounts) {
    accountInfos.push(await login(username, password));
  }
  console.log('CF_BOT_USERNAME=' + accounts.map(([u]) => u).join(';'));
  console.log(
    'CF_COOKIE=' + accountInfos.map(({ session }) => session).join(';')
  );
  console.log(
    'CF_CSRF_TOKEN=' +
      accountInfos.map(({ csrf_token }) => csrf_token).join(';')
  );

  await browser.close();
})();
