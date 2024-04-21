import fastify from 'fastify';
import { z } from 'zod';
import { login } from './login';

const app = fastify();
const port = 3100;

app.get('/', () => {
  return 'ok';
});

const LoginRequest = z.object({
  username: z.string(),
  password: z.string(),
});
app.post('/login/codeforces', async (req, res) => {
  const { username, password } = LoginRequest.parse(req.body);
  return await login(username, password);
});

app
  .listen({
    port: 3100,
    host: '0.0.0.0',
  })
  .then(() => {
    console.log(`Server is running at http://localhost:${port}`);
  });
