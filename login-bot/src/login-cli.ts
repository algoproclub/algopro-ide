import { login } from './login';
import { readFile } from 'fs/promises';

(async () => {
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
  console.log('CF_BOT_USERNAME="' + accounts.map(([u]) => u).join(';') + '"');
  console.log(
    'CF_COOKIE="' +
      accountInfos.map(({ session }) => 'JSESSIONID=' + session).join(';') +
      '"'
  );
  console.log(
    'CF_CSRF_TOKEN="' +
      accountInfos.map(({ csrf_token }) => csrf_token).join(';') +
      '"'
  );
})();
