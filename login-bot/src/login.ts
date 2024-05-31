import {
  chromium,
  devices,
  Browser,
  BrowserContext,
  Response,
} from 'playwright';

let browser: Browser | null = null;

async function withContext<T>(fn: (context: BrowserContext) => Promise<T>) {
  browser ??= await chromium.launch();
  const context = await browser.newContext({
    recordVideo: {
      dir: 'videos/',
    },
  });
  let result: T;
  try {
    result = await fn(context);
  } finally {
    await context.close();
  }
  return result;
}

async function cookies(context: BrowserContext): Promise<string> {
  return (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; ');
}

export const bots = {
  codeforces: (username: string, password: string) =>
    withContext(async context => {
      const page = await context.newPage();
      let resp: Response | null;
      await page.goto('https://codeforces.com/enter?back=%2F');
      await page.fill('input[name="handleOrEmail"]', username);
      await page.fill('input[name="password"]', password);
      await page.check('input[name="remember"]');
      await page.click('input[type="submit"]');
      await page.waitForURL('https://codeforces.com/');

      if (!(await context.cookies()).some(c => c.name === 'JSESSIONID'))
        throw new Error('Session cookie not found');
      do {
        resp = await page.goto('https://codeforces.com/problemset/submit');
      } while (resp?.status() !== 200);
      const csrf_token = await page
        .locator('.submit-form input[name="csrf_token"]')
        .getAttribute('value');
      if (!csrf_token) throw new Error('CSRF token not found');
      console.log('Logged in as ' + username);
      return { username, cookie: await cookies(context), csrf_token };
    }),
  spoj: (username: string, password: string) =>
    withContext(async context => {
      const page = await context.newPage();
      await page.goto('https://www.spoj.com/login');
      await page.fill('#content input[name="login_user"]', username);
      await page.fill('#content input[name="password"]', password);
      await page.check('#content input[name="autologin"]');
      await page.click('#content button[type="submit"]');
      await page.waitForURL('https://www.spoj.com/');
      await page.goto('https://www.spoj.com/myaccount/');
      if (!(await page.innerText('body')).includes(username)) {
        throw new Error('Login failed');
      }
      if (!(await context.cookies()).some(c => c.name === 'SPOJ'))
        throw new Error('Session cookie not found');
      console.log('Logged in as ' + username);
      return { username, cookie: await cookies(context) };
    }),
};
