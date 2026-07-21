import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const builtHtml = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");

const pixelId = "371015920001593";

function assertPixelMarkup(markup) {
  assert.match(markup, /https:\/\/connect\.facebook\.net\/en_US\/fbevents\.js/);
  assert.match(markup, new RegExp(`fbq\\('init', '${pixelId}'\\)`));
  assert.match(markup, /fbq\('track', 'PageView'\)/);
  assert.match(
    markup,
    new RegExp(`https://www\\.facebook\\.com/tr\\?id=${pixelId}&ev=PageView&noscript=1`)
  );
}

test("loads Vessi's Meta Pixel and tracks the initial PageView", () => {
  assertPixelMarkup(html);

  const pixelScriptIndex = html.indexOf("https://connect.facebook.net/en_US/fbevents.js");
  assert.ok(pixelScriptIndex > html.indexOf("<head>"));
  assert.ok(pixelScriptIndex < html.indexOf("</head>"));
});

test("provides the standard no-script PageView fallback", () => {
  assert.match(html, /<noscript><img height="1" width="1" style="display:none"/);
});

test("ships the Meta Pixel in the committed production build", () => {
  assertPixelMarkup(builtHtml);
});
