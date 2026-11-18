import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

for (const consumer of ['micromatch', 'tinyglobby']) {
  test(`${consumer} uses the hardened filename matcher`, () => {
    const fromConsumer = createRequire(require.resolve(consumer));
    const match = fromConsumer('picomatch');

    for (const operator of ['+', '*']) {
      const pattern = `assets/${operator}(icon*.svg)/file`;
      assert.doesNotMatch(match.makeRe(pattern).source, /\)[+*]/);
      assert.equal(match(pattern)('assets/icon.svgicon-dark.svg/file'), true);
      assert.equal(match(pattern)('assets/icon/readme.svg/file'), false);
      assert.equal(match(pattern)('assets//file'), operator === '*');
    }
    assert.equal(match('src/**/*.{ts,tsx}')('src/ui/page.tsx'), true);
    assert.equal(match('+(ab)')('abab'), true);
  });
}
