import fastify from 'fastify';
import { z } from 'zod';
import { bots } from './login';

const app = fastify();
const port = 3100;

app.get('/', () => {
  return 'ok';
});

const LoginRequest = z.object({
  platform: z.enum(['codeforces', 'spoj']),
  username: z.string(),
  password: z.string(),
});
app.post('/login', async (req, res) => {
  const { platform, username, password } = LoginRequest.parse(req.body);
  console.log('Logging into', platform, 'as', username);
  return await bots[platform](username, password);
});

app
  .listen({
    port: 3100,
    host: '0.0.0.0',
  })
  .then(() => {
    console.log(`Server is running at http://localhost:${port}`);
  });
