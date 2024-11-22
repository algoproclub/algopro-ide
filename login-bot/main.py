import asyncio
import nodriver as uc
from itertools import batched
from aiohttp import web
import logging
from asyncio import timeout
import curl_cffi.requests
import traceback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
browser = None


def get_attribute(el, attr):
    return next((v for k, v in batched(el.attributes, 2) if k == attr), None)


async def codeforces(username, password):
    page = await browser.get("https://codeforces.com/enter")
    try:
        await page.verify_cf()
    except Exception:
        print("CF verification timed out")
    await (await page.select('input[name="handleOrEmail"]')).send_keys(username)
    await (await page.select('input[name="password"]')).send_keys(password)
    await (await page.select('input[name="remember"]')).click()
    await (await page.select('input[type="submit"]')).click()
    await page.wait_for(text=f"Welcome, {username}")
    cookies = await browser.cookies.get_all()
    if not any(c.name == "JSESSIONID" for c in cookies):
        raise Exception("Session cookie not found")
    await page.get("https://codeforces.com/problemset/submit")
    csrf_token = get_attribute(
        await page.select('.submit-form input[name="csrf_token"]'), "value"
    )
    if not csrf_token:
        raise Exception("CSRF token not found")
    logger.info("Logged in as %s", username)
    return {
        "username": username,
        "cookie": "; ".join(f"{c.name}={c.value}" for c in cookies),
        "csrf_token": csrf_token,
        "useragent": await page.evaluate("navigator.userAgent"),
    }


async def spoj(username, password):
    page = await browser.get("https://www.spoj.com/login")
    await (await page.select('#content input[name="login_user"]')).send_keys(username)
    await (await page.select('#content input[name="password"]')).send_keys(password)
    await (await page.select('#content input[name="autologin"]')).click()
    await (await page.select('#content button[type="submit"]')).click()
    await page.wait_for(text="Sign out")
    await page.get("https://www.spoj.com/myaccount/")
    await page.wait()
    if username not in await page.get_content():
        raise Exception("Login failed")
    cookies = await browser.cookies.get_all()
    if not any(c.name == "SPOJ" for c in cookies):
        raise Exception("Session cookie not found")
    logger.info("Logged in as %s", username)
    return {
        "username": username,
        "cookie": "; ".join(f"{c.name}={c.value}" for c in cookies),
    }

async def atcoder(username, password):
    page = await browser.get("https://atcoder.jp/login")
    await (await page.select('#username')).send_keys(username)
    await (await page.select('#password')).send_keys(password)
    await (await page.select('#submit')).click()
    await page.wait_for(text="Welcome, " + username)
    cookies = await browser.cookies.get_all()
    if not any(c.name == "REVEL_SESSION" for c in cookies):
        raise Exception("Session cookie not found")
    csrf_token = get_attribute(await page.select('input[name="csrf_token"]'), "value")
    logger.info("Logged in as %s", username)
    return {
        "username": username,
        "cookie": "; ".join(f"{c.name}={c.value}" for c in cookies),
        "csrf_token": csrf_token,
    }


async def ojuz(username, password):
    page = await browser.get("https://oj.uz/login")
    await (await page.select('#email')).send_keys(username)
    await (await page.select('#password')).send_keys(password)
    await (await page.select('#submit')).click()
    await page.wait_for(text="Sign out")
    cookies = await browser.cookies.get_all()
    if not any(c.name == "session" for c in cookies):
        raise Exception("Session cookie not found")
    logger.info("Logged in as %s", username)
    return {
        "username": username,
        "cookie": "; ".join(f"{c.name}={c.value}" for c in cookies),
    }


lock = asyncio.Lock()
routes = web.RouteTableDef()


@routes.get("/")
async def health_check(request):
    return web.Response(text="ok")


@routes.post("/login")
async def login(request):
    try:
        data = await request.json()
        if data.get("platform") == "codeforces":
            func = codeforces
        elif data.get("platform") == "spoj":
            func = spoj
        elif data.get("platform") == "atcoder":
            func = atcoder
        elif data.get("platform") == "ojuz":
            func = ojuz
        else:
            return web.json_response({"error": "Invalid platform"}, status=400)
        if not isinstance(data.get("username"), str) or not isinstance(
            data.get("password"), str
        ):
            return web.json_response({"error": "Invalid request"}, status=400)

        async with lock, timeout(30):
            logger.info("Logging in as %s to %s", data["username"], data["platform"])
            global browser
            if not browser or browser.stopped:
                logger.info("Starting browser")
                config = uc.Config()
                config.host = "127.0.0.1"
                config.port = 55555
                browser = await uc.Browser.create(config)
            for tab in browser.tabs[1:]:
                await tab.close()
            await browser.get("about:blank")
            await browser.cookies.clear()
            try:
                return web.json_response(
                    await func(
                        data["username"],
                        data["password"],
                    )
                )
            except Exception as e:
                logger.error("Error logging in", exc_info=e)
                return web.json_response({"error": str(e)}, status=500)
            await browser.get("about:blank")
    except asyncio.TimeoutError:
        return web.json_response({"error": "timeout\n" + traceback.format_exc()}, status=500)
    except Exception as e:
        logger.error("Error", exc_info=e)
        return web.json_response({"error": traceback.format_exc()}, status=500)


@routes.route("*", "/proxy")
async def proxy(request):
    url = request.query.get("url")
    body = await request.content.read()
    if not url or not url.startswith("https://"):
        return web.json_response({"error": "Invalid URL"}, status=400)
    async with curl_cffi.requests.AsyncSession() as session:
        headers = dict(request.headers)
        headers.pop("Host", None)
        headers.pop("Content-Encoding", None)
        headers.pop("Transfer-Encoding", None)
        headers.pop("Content-Length", None)
        response = await session.request(
            request.method,
            url,
            headers=headers,
            timeout=10,
            data=body,
        )
        response.headers.pop("Content-Encoding", None)
        response.headers.pop("Transfer-Encoding", None)
        response.headers.pop("Content-Length", None)
        response.headers["X-Proxy-Final-Url"] = response.redirect_url or response.url
        return web.Response(
            body=response.content,
            status=response.status_code,
            headers=response.headers,
        )


app = web.Application()
app.add_routes(routes)
web.run_app(app, port=3100)
