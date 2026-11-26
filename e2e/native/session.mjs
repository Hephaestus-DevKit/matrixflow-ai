import { Builder, By, Key } from 'selenium-webdriver';
import safari from 'selenium-webdriver/safari.js';
import { readFile, writeFile, readdir, stat, unlink, mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const library = await readFile(
  require.resolve('@testing-library/dom/dist/@testing-library/dom.umd.min.js'),
  'utf8',
);

export async function launchSafari(fixture) {
  const service = new safari.ServiceBuilder('/usr/bin/safaridriver').build();
  const scratch = await mkdtemp(join(tmpdir(), 'matrixflow-safari-'));
  const sessionDeadline = new AbortController();
  let driver;
  try {
    const session = service
      .start()
      .then((url) =>
        new Builder().disableEnvironmentOverrides().usingServer(url).forBrowser('safari').build(),
      );
    driver = await Promise.race([
      session,
      delay(20000, undefined, { signal: sessionDeadline.signal }).then(() => {
        throw new Error('Safari WebDriver did not establish a browser session within 20 seconds');
      }),
    ]);
  } catch (err) {
    await Promise.allSettled([service.kill(), rm(scratch, { recursive: true, force: true })]);
    throw err;
  } finally {
    sessionDeadline.abort();
  }

  async function newPage({ viewport }) {
    const [dx, dy] = await driver.executeScript(
      'return [outerWidth-innerWidth,outerHeight-innerHeight]',
    );
    await driver
      .manage()
      .window()
      .setRect({ x: 0, y: 0, width: viewport.width + dx, height: viewport.height + dy });
    function selector(steps) {
      async function matches() {
        return driver.executeScript(function (steps) {
          let roots = [document.body];
          for (const { type, value, regexp, exact, level } of steps) {
            const name = regexp
              ? new RegExp(value)
              : typeof value === 'string' &&
                  !exact &&
                  !['css', 'id', 'label', 'text'].includes(type)
                ? new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                : value;
            if (type === 'nth') {
              roots = roots.slice(value, value + 1);
              continue;
            }
            if (type === 'filter') {
              roots = roots.filter((el) => el.textContent.includes(value));
              continue;
            }
            if (type === 'first') {
              roots = roots.slice(0, 1);
              continue;
            }
            roots = roots.flatMap((root) => {
              if (type === 'css')
                return [...(root === document.body ? document : root).querySelectorAll(value)];
              if (type === 'id') return TestingLibraryDom.queryAllByTestId(root, name);
              if (type === 'label')
                return TestingLibraryDom.queryAllByLabelText(root, name, { exact });
              if (type === 'text') return TestingLibraryDom.queryAllByText(root, name, { exact });
              return TestingLibraryDom.queryAllByRole(root, type, { name, level });
            });
          }
          return roots;
        }, steps);
      }
      const first = async () =>
        driver.wait(async () => (await matches())[0], 5000, JSON.stringify(steps));
      return {
        ...queries(steps),
        async check() {
          const el = await first();
          if (await el.isSelected()) return;
          await driver.executeScript((el) => {
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            el.focus();
          }, el);
          await driver.actions().sendKeys(Key.SPACE).perform();
          await driver.wait(() => el.isSelected(), 5000, 'Checkbox did not become checked');
        },
        value: async () => (await first()).getProperty('value'),
        scrollIntoViewIfNeeded: async () =>
          driver.executeScript("arguments[0].scrollIntoView({block:'nearest'})", await first()),
        inViewport: async () =>
          driver.executeScript(
            function (el) {
              const r = el.getBoundingClientRect();
              return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
            },
            await first(),
          ),
        evaluateAll: async (fn) => driver.executeScript(fn, await matches()),
        nth: (value) => selector([...steps, { type: 'nth', value }]),
        filter: ({ hasText }) => selector([...steps, { type: 'filter', value: hasText }]),
        enabled: async () => (await first()).isEnabled(),
        focused: async () =>
          driver.executeScript('return arguments[0] === document.activeElement', await first()),
        focus: async () => driver.executeScript('arguments[0].focus()', await first()),
        press: async (key) =>
          driver
            .actions()
            .sendKeys(Key[key === 'ArrowRight' ? 'ARROW_RIGHT' : key.toUpperCase()])
            .perform(),
        innerText: async () => (await first()).getProperty('innerText'),
        async selectOption(value) {
          await driver.wait(
            async () =>
              driver.executeScript(
                (select, requestedValue) => {
                  const option = Array.from(select.options).find(
                    (item) => item.value === requestedValue,
                  );
                  if (select.disabled || !option || option.matches(':disabled')) return false;
                  select.value = requestedValue;
                  select.dispatchEvent(new Event('input', { bubbles: true }));
                  select.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                },
                await first(),
                value,
              ),
            15000,
            'Select option never became available: ' + value,
          );
        },
        first: () => selector([...steps, { type: 'first' }]),
        async click() {
          const el = await first();
          await driver.wait(
            () =>
              driver.executeScript(function (el) {
                el.scrollIntoView({ block: 'center', behavior: 'instant' });
                const r = el.getBoundingClientRect();
                return el.contains(
                  document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
                );
              }, el),
            5000,
          );
          await driver.executeScript(
            "window.safariClickSeen = false; arguments[0].addEventListener('click',()=>window.safariClickSeen=true,{once:true,capture:true})",
            el,
          );
          await el.click();
          if (!(await driver.executeScript('return window.safariClickSeen'))) {
            const current = (await matches())[0];
            if (current) await current.click();
          }
        },
        async fill(value) {
          const el = await first();
          await driver.executeScript(
            "arguments[0].focus(); Object.getOwnPropertyDescriptor(Object.getPrototypeOf(arguments[0]),'value').set.call(arguments[0],arguments[1]); arguments[0].dispatchEvent(new Event('input',{bubbles:true})); arguments[0].dispatchEvent(new Event('change',{bubbles:true}));",
            el,
            value,
          );
        },
        async setInputFiles({ name, buffer }) {
          const file = join(scratch, name);
          await writeFile(file, buffer);
          await (await first()).sendKeys(file);
        },
        count: async () => (await matches()).length,
        textContent: async () => (await first()).getProperty('textContent'),
        allTextContents: async () =>
          Promise.all((await matches()).map((el) => el.getProperty('textContent'))),
        getAttribute: async (name) => (await first()).getAttribute(name),
        evaluate: async (fn) => driver.executeScript(fn, await first()),
        isVisible: async () => {
          const el = (await matches())[0];
          return Boolean(
            el &&
            (await driver.executeScript(function (el) {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
            }, el)),
          );
        },
        async waitFor({ state = 'visible', timeout = 5000 } = {}) {
          await driver.wait(
            async () => {
              try {
                const el = (await matches())[0];
                return (
                  Boolean(
                    el &&
                    (await driver.executeScript(function (el) {
                      const r = el.getBoundingClientRect();
                      return (
                        r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
                      );
                    }, el)),
                  ) ===
                  (state !== 'hidden')
                );
              } catch (error) {
                if (error.name !== 'StaleElementReferenceError') throw error;
                return false;
              }
            },
            timeout,
            JSON.stringify(steps),
          );
        },
      };
    }
    function queries(steps) {
      function append(type, name, exact = true, level) {
        return selector([
          ...steps,
          {
            type,
            value: name instanceof RegExp ? name.source : name,
            regexp: name instanceof RegExp,
            exact,
            level,
          },
        ]);
      }
      return {
        getByTestId: (id) => append('id', id),
        locator: (css) => append('css', css),
        getByRole: (role, { name, exact, level } = {}) => append(role, name, exact ?? false, level),
        getByText: (text, opts) => append('text', text, opts?.exact ?? false),
        getByLabel: (label) => append('label', label),
      };
    }
    async function injectLibrary() {
      await driver.executeScript(library);
    }
    await driver.get('http://127.0.0.1:3100/__safari_boot');
    const context = {
      addInitScript: (fn) => fixture.init.push(fn),
      cookies: () => driver.manage().getCookies(),
      async addCookies(cookies) {
        for (const cookie of cookies) await driver.manage().addCookie(cookie);
      },
      request: {
        async get(path) {
          const cookies = await driver.manage().getCookies();
          const r = await fetch(new URL(path, 'http://127.0.0.1:3100'), {
            headers: { Cookie: cookies.map((c) => c.name + '=' + c.value).join('; ') },
          });
          return { status: () => r.status, text: () => r.text() };
        },
      },
    };
    return {
      ...queries([]),
      evaluate: (fn, ...args) => driver.executeScript(fn, ...args),
      async goto(path) {
        await driver.get(new URL(path, 'http://127.0.0.1:3100').href);
        await injectLibrary();
      },
      async reload() {
        await driver.navigate().refresh();
        await injectLibrary();
      },
      async setViewportSize({ width, height }) {
        await driver
          .manage()
          .window()
          .setRect({ x: 0, y: 0, width: width + dx, height: height + dy });
      },
      title: () => driver.getTitle(),
      url: () => driver.getCurrentUrl(),
      addStyleTag: ({ content }) =>
        driver.executeScript(
          "const s=document.createElement('style');s.textContent=arguments[0];document.head.append(s)",
          content,
        ),
      setDefaultTimeout: (ms) => driver.manage().setTimeouts({ implicit: 0, script: ms }),
      setDefaultNavigationTimeout: (ms) => driver.manage().setTimeouts({ pageLoad: ms }),
      errors: () => driver.executeScript('return window.safariErrors'),
      route: (_pattern, callback) => fixture.setRoute(callback),
      context: () => context,
      async audit(tags, scope = null) {
        await driver.executeScript(await readFile(require.resolve('axe-core/axe.min.js'), 'utf8'));
        return driver.executeAsyncScript(
          "const done=arguments[arguments.length-1]; axe.run(arguments[1]||document,{runOnly:{type:'tag',values:arguments[0]}}).then(done,e=>done({error:String(e)}))",
          tags,
          scope,
        );
      },
      screenshot: async ({ path }) =>
        writeFile(path, Buffer.from(await driver.takeScreenshot(), 'base64')),
      waitForTimeout: delay,
      keyboard: {
        press: async (key) =>
          key === 'Control+K'
            ? driver.actions().keyDown(Key.CONTROL).sendKeys('k').keyUp(Key.CONTROL).perform()
            : driver
                .actions()
                .sendKeys({ Escape: Key.ESCAPE, Tab: Key.TAB, Enter: Key.ENTER }[key] ?? key)
                .perform(),
      },
      mouse: {
        click: (x, y) =>
          driver
            .actions()
            .move({ x: Math.round(x), y: Math.round(y) })
            .click()
            .perform(),
      },
    };
  }
  return {
    newPage,
    async close() {
      try {
        await driver.quit();
      } finally {
        try {
          await service.kill();
        } finally {
          await rm(scratch, { recursive: true, force: true });
        }
      }
    },
  };
}

// Safari saves downloads outside the WebDriver session. Only accept files created by this action.
export async function watchDownload(page, extension) {
  const prefix = 'matrixflow-test-' + randomUUID() + '-';
  await page.evaluate((token) => {
    const proto = HTMLAnchorElement.prototype;
    const descriptor = (window.originalDownloadDescriptor ??= Object.getOwnPropertyDescriptor(
      proto,
      'download',
    ));
    Object.defineProperty(proto, 'download', {
      ...descriptor,
      set(filename) {
        descriptor.set.call(this, token + filename);
      },
    });
  }, prefix);
  const dir = join(homedir(), 'Downloads');
  return async () => {
    for (let n = 0; n < 200; n++) {
      const filename = (await readdir(dir)).find(
        (name) => name.startsWith(prefix) && name.endsWith(extension),
      );
      if (filename && (await stat(join(dir, filename))).size > 0) {
        const file = join(dir, filename);
        return {
          name: filename.slice(prefix.length),
          async read() {
            try {
              return await readFile(file);
            } finally {
              await unlink(file);
            }
          },
        };
      }
      await delay(100);
    }
    throw new Error('Safari download did not finish: ' + extension);
  };
}
