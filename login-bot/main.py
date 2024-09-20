import asyncio
import nodriver as uc
from itertools import batched
from aiohttp import web
import logging
from asyncio import timeout

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
browser = None


def get_attribute(el, attr):
    return next((v for k, v in batched(el.attributes, 2) if k == attr), None)


async def codeforces(username, password):
    page = await browser.get("https://codeforces.com/enter")
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


lock = asyncio.Lock()
routes = web.RouteTableDef()


@routes.get("/")
async def health_check(request):
    return web.Response(text="ok")


@routes.post("/login")
async def login(request):
    data = await request.json()
    if data.get("platform") == "codeforces":
        func = codeforces
    elif data.get("platform") == "spoj":
        func = spoj
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
            browser = await uc.start(no_sandbox=True)
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


app = web.Application()
app.add_routes(routes)
web.run_app(app, port=3100)
