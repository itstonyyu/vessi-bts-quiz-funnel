import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("campaign hero is removed from layout after the welcome screen", () => {
  assert.match(html, /\.shell\.quiz-started \.brand-panel\s*{\s*display: none;/);
  assert.match(html, /shell\.classList\.toggle\("quiz-started", !isLanding\)/);
  assert.match(html, /shell\.dataset\.view = isLanding \? "landing" : "quiz"/);
});

test("question screens reset to the top and use the mobile viewport", () => {
  assert.match(html, /if \(!isLanding\) window\.scrollTo\(\{ top: 0, left: 0, behavior: "instant" \}\)/);
  assert.match(html, /\.shell\.quiz-started \.quiz-card\s*{[\s\S]*?min-height: calc\(100dvh - 24px\)/);
  assert.match(html, /<h2 tabindex="-1">\$\{title\}<\/h2>/);
});

test("selected questions use compact, decorative lifestyle accents", () => {
  assert.match(html, /\.question-accent\s*{[\s\S]*?width: min\(100%, 320px\);[\s\S]*?height: 88px;/);
  assert.match(html, /\.shell\.quiz-started \.question-accent\s*{[\s\S]*?height: 72px;/);
  assert.match(html, /@media \(min-width: 1025px\) and \(max-height: 760px\)[\s\S]*?\.shell\.quiz-started \.question-accent\s*{\s*display: none;/);
  assert.match(html, /<figure class="question-accent" aria-hidden="true"><img src="\$\{media\}" alt="" loading="lazy" decoding="async"><\/figure>/);
  assert.match(html, /student_rain\(\)[\s\S]*?media: "img\/brand-rain\.jpg"/);
  assert.match(html, /student_lifestyle\(\)[\s\S]*?media: "img\/weekend-classic-lifestyle\.jpg"/);
  assert.match(html, /teacher_use\(\)[\s\S]*?media: "img\/brand-work\.jpg"/);
});