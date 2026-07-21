import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const styles = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";

const brandTokens = {
  "--vessi-blue": "#0069F0",
  "--vessi-ink": "#28201A",
  "--vessi-white": "#FFFFFF",
  "--vessi-border": "#E6E6E6",
  "--vessi-grey": "#D8D8D8",
  "--vessi-bone": "#F4F0E9",
  "--vessi-sky": "#4D96F5",
  "--vessi-scrim": "rgba(85, 83, 70, 0.5)"
};

test("uses the exact Vessi palette and removes the old campaign palette", () => {
  for (const [token, value] of Object.entries(brandTokens)) {
    assert.match(styles, new RegExp(`${token}:\\s*${value.replace(/[()]/g, "\\$&")}`, "i"));
  }

  for (const obsolete of ["--moss", "--moss-dark", "--clay", "--sun", "--aqua", "#171512", "#fffaf3", "#fffaf2", "#314d3b", "#000000"]) {
    assert.doesNotMatch(styles, new RegExp(obsolete, "i"), `obsolete color remains: ${obsolete}`);
  }
});

test("uses only official Vessi typography roles and available weights", () => {
  assert.match(styles, /@font-face\s*{[\s\S]*?font-family:\s*['"]Noi Grotesk['"][\s\S]*?font-weight:\s*400/);
  assert.match(styles, /@font-face\s*{[\s\S]*?font-family:\s*['"]Noi Grotesk['"][\s\S]*?font-weight:\s*500/);
  assert.match(styles, /@font-face\s*{[\s\S]*?font-family:\s*['"]ABCDiatypeMono['"][\s\S]*?font-weight:\s*400/);
  assert.match(styles, /html\s*{[\s\S]*?font-family:\s*['"]Noi Grotesk['"]/);
  assert.match(styles, /\.kicker[\s\S]*?font-family:\s*['"]ABCDiatypeMono['"][\s\S]*?letter-spacing:\s*0\.04em[\s\S]*?text-transform:\s*uppercase/);
  assert.match(styles, /\.brand-bottom h1\s*{[\s\S]*?font-size:\s*clamp\(44px, 6vw, 72px\)/);

  for (const fakeWeight of [600, 700, 750, 800, 850, 900]) {
    assert.doesNotMatch(styles, new RegExp(`font-weight:\\s*${fakeWeight}\\b`), `unsupported font weight remains: ${fakeWeight}`);
  }
  assert.doesNotMatch(html, /fonts\.googleapis\.com|family=Inter/);
});

test("buttons use pill geometry, sentence case, and the exact focus outline", () => {
  assert.match(styles, /\.primary,[\s\S]*?\.secondary\s*{[\s\S]*?border-radius:\s*9999px/);
  assert.match(styles, /:focus-visible\s*{[\s\S]*?outline:\s*2px solid var\(--vessi-blue\);[\s\S]*?outline-offset:\s*2px/);
  for (const titleCaseCta of ["Find My Match", "Shop My Match", "Continue to Entry", "See My Result", "Share With My School", "Start Over"]) {
    assert.doesNotMatch(html, new RegExp(`>${titleCaseCta}<|button\\(\\"${titleCaseCta}\\"`));
  }
});

test("Typeform student and teacher images preserve their full composition", () => {
  assert.match(html, /mediaClass:\s*"statement-media"/);
  assert.match(html, /media:\s*"img\/typeform-student\.jpg"/);
  assert.match(html, /media:\s*"img\/typeform-teacher\.jpg"/);
  assert.match(html, /class="question-accent \$\{mediaClass\}"/);
  assert.match(styles, /\.question-accent\.statement-media\s*{[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(styles, /\.question-accent img\s*{[\s\S]*?object-fit:\s*contain/);
});

test("customer-facing product proof matches the supplied Typeform", () => {
  assert.match(html, /waterproof sneakers built for campus weather/);
  assert.match(html, /keep your feet dry, breathable, and comfortable/);
  assert.match(html, /waterproof sneakers made for real school days/);
  assert.doesNotMatch(html, /easy-clean waterproof protection|Built for rainy commutes|Built for rainy campus walks/);
});
