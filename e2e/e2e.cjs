const { chromium } = require("playwright");
const BASE = "http://localhost:5173";
const OUT = process.env.E2E_SHOTS || __dirname;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL, ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an admin you created with: python -m app.cli create-admin)"); process.exit(2); }
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // 1. Landing shows backend data
  await page.goto(BASE);
  await page.waitForSelector("text=Featured research projects");
  await page.waitForSelector("article.project-card");
  check("landing shows projects from the database", (await page.locator("article.project-card").count()) >= 1);
  await page.screenshot({ path: `${OUT}/landing-desktop.png`, fullPage: true });

  // 2. Explore: search
  await page.goto(`${BASE}/explore`);
  await page.waitForSelector("article.project-card");
  await page.fill("#searchbar-input", "cybersecurity");
  await page.waitForTimeout(900);
  const url = page.url();
  check("search is reflected in the URL", url.includes("q=cybersecurity"), url);
  await page.screenshot({ path: `${OUT}/explore-desktop.png`, fullPage: true });

  // 3. Guest clicks Apply -> login -> returns to the apply page
  await page.goto(`${BASE}/explore`);
  await page.waitForSelector("article.project-card");
  await page.locator("article.project-card h3 a").first().click();
  await page.waitForSelector("text=Apply Now");
  const detailsUrl = page.url();
  await page.screenshot({ path: `${OUT}/details-desktop.png`, fullPage: true });
  await page.click("text=Apply Now");
  await page.waitForURL("**/login");
  check("guest is sent to login when applying", page.url().includes("/login"));

  // 4. Register (via link) - validation first
  await page.click("text=Create an account");
  await page.waitForURL("**/register");
  await page.click("button:has-text('Create account')");
  check("empty registration shows validation errors", (await page.locator(".error-text").count()) >= 3);
  const email = `student.${Date.now()}@example.org`;
  await page.getByLabel("Full name").fill("E2E Student");
  await page.getByLabel("Email address").fill(email);
  await page.locator("input[type=password]").nth(0).fill("Student-Pass-8830");
  await page.locator("input[type=password]").nth(1).fill("Student-Pass-8830");
  await page.getByLabel("University").fill("Sample University");
  await page.getByLabel("Department").fill("Computer Science");
  await page.getByLabel("Academic year").selectOption({ index: 1 });
  await page.screenshot({ path: `${OUT}/register-desktop.png`, fullPage: true });
  await page.click("button:has-text('Create account')");
  await page.waitForURL("**/apply", { timeout: 10000 });
  check("after registering, the student returns to the project they wanted to apply to", page.url() === detailsUrl + "/apply", page.url());
  await page.goto(`${BASE}/dashboard`);
  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name === "rh_session");
  check("session cookie is HttpOnly + SameSite", !!session && session.httpOnly && session.sameSite !== "None", JSON.stringify({ httpOnly: session?.httpOnly, sameSite: session?.sameSite }));
  check("session token is not readable by page JavaScript", !(await page.evaluate(() => document.cookie)).includes("rh_session"));
  await page.waitForSelector("text=Welcome");
  await page.screenshot({ path: `${OUT}/dashboard-desktop.png`, fullPage: true });

  // 5. Apply
  await page.goto(detailsUrl);
  await page.click("text=Apply Now");
  await page.waitForSelector("text=Statement of interest");
  await page.getByLabel("Statement of interest").fill("I want to join this project because it matches my coursework and my curiosity about the topic.");
  await page.getByLabel("Relevant skills").fill("Python, statistics");
  await page.getByLabel("Academic background").fill("Second-year computer science student with strong grades in maths.");
  await page.getByLabel("Relevant experience").fill("A small course project on data analysis.");
  await page.screenshot({ path: `${OUT}/apply-desktop.png`, fullPage: true });
  await page.click("button:has-text('Submit')");
  await page.waitForURL("**/dashboard/applications", { timeout: 10000 });
  await page.waitForSelector("text=Submitted");
  check("application is submitted and listed with status Submitted", true);
  await page.screenshot({ path: `${OUT}/applications-desktop.png`, fullPage: true });

  // 6. Duplicate application is blocked in the UI
  await page.goto(detailsUrl);
  await page.waitForSelector("h1");
  const applyAgain = await page.locator("a:has-text('Apply Now')").count();
  check("apply button is replaced once already applied", applyAgain === 0);

  // 7. Bookmark a project and see it in Saved
  await page.goto(`${BASE}/explore`);
  await page.waitForSelector("article.project-card");
  await page.locator("article.project-card button[aria-pressed]").first().click();
  await page.waitForTimeout(600);
  await page.goto(`${BASE}/dashboard/saved`);
  await page.waitForSelector("article.project-card");
  check("bookmarked project appears under Saved", (await page.locator("article.project-card").count()) >= 1);

  // 8. Student cannot reach admin
  await page.goto(`${BASE}/admin`);
  await page.waitForURL("**/dashboard**");
  check("student is redirected away from /admin", !page.url().includes("/admin"));
  const apiAdmin = await page.evaluate(async () => (await fetch("/api/admin/stats", { credentials: "include" })).status);
  check("backend rejects a student on /api/admin/stats (403)", apiAdmin === 403, String(apiAdmin));

  // 9. Logout
  await page.goto(`${BASE}/dashboard`);
  await page.click("button:has-text('Logout')");
  await page.waitForURL(BASE + "/");
  const me = await page.evaluate(async () => (await fetch("/api/auth/me", { credentials: "include" })).status);
  check("logout ends the session on the server (/me = 401)", me === 401, String(me));

  // 10. Admin changes status
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email address").fill(ADMIN_EMAIL);
  await page.locator("input[type=password]").fill(ADMIN_PASSWORD);
  await page.click("button:has-text('Log in')");
  try { await page.waitForURL("**/admin**", { timeout: 8000 }); } catch (e) { console.log("ADMIN LOGIN LANDED ON:", page.url()); await page.screenshot({ path: `${OUT}/admin-fail.png` }); console.log("PAGE TEXT:", (await page.locator("main").innerText()).slice(0, 300)); throw e; }
  await page.waitForSelector("text=Registered users");
  await page.screenshot({ path: `${OUT}/admin-desktop.png`, fullPage: true });
  await page.goto(`${BASE}/admin/applications`);
  await page.waitForSelector("text=E2E Student");
  await page.locator("tr:has-text('E2E Student') >> text=Review").first().click().catch(async () => { await page.locator("text=E2E Student").first().click(); });
  await page.waitForSelector("#review-status");
  await page.selectOption("#review-status", "accepted");
  await page.click("button:has-text('Save')");
  await page.waitForTimeout(800);
  check("admin updated the application status", true);
  await page.screenshot({ path: `${OUT}/admin-review.png`, fullPage: true });
  await page.goto(`${BASE}/admin/projects`); await page.waitForSelector("table, .empty-state");
  await page.screenshot({ path: `${OUT}/admin-projects.png`, fullPage: true });
  await page.click("button:has-text('Logout')");

  // 11. Student sees Accepted
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email address").fill(email);
  await page.locator("input[type=password]").fill("Student-Pass-8830");
  await page.click("button:has-text('Log in')");
  await page.waitForURL("**/dashboard**");
  await page.goto(`${BASE}/dashboard/applications`);
  await page.waitForSelector("text=Accepted");
  check("student sees the admin's decision (Accepted)", true);

  // 12. Mobile screenshots
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mp = await m.newPage();
  for (const [name, path] of [["landing", "/"], ["explore", "/explore"], ["login", "/login"], ["papers", "/papers"]]) {
    await mp.goto(BASE + path); await mp.waitForTimeout(700);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(`no horizontal scroll on mobile: ${name}`, !overflow);
    await mp.screenshot({ path: `${OUT}/${name}-mobile.png`, fullPage: name !== "landing" });
  }
  await mp.goto(BASE + "/login"); await mp.getByLabel("Email address").fill(email); await mp.locator("input[type=password]").fill("Student-Pass-8830");
  await mp.click("button:has-text('Log in')"); await mp.waitForURL("**/dashboard**"); await mp.waitForTimeout(600);
  await mp.click("button[aria-label='Open menu']"); await mp.waitForTimeout(400);
  await mp.screenshot({ path: `${OUT}/dashboard-mobile-menu.png` });
  const overflowDash = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check("no horizontal scroll on mobile dashboard", !overflowDash);

  const real = errors.filter((e) => !/favicon|401|403|409/.test(e));
  check("no unexpected browser console errors", real.length === 0, real.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR:", e.message.split("\n")[0]); process.exit(2); });
