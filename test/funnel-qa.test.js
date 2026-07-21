import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const styles = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";

test("all pill CTAs center their labels consistently", () => {
  assert.match(styles, /\.primary,\s*\.secondary\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?line-height:\s*1;/);
});

test("thank-you screen never exposes internal segmentation or quiz diagnostics", () => {
  assert.doesNotMatch(html, /Your quiz profile/);
  assert.doesNotMatch(html, /<strong>Intent<\/strong>/);
  assert.doesNotMatch(html, /intentBucket\(\)\.replace/);
  assert.doesNotMatch(html, /<strong>Role<\/strong>|<strong>Region<\/strong>|<strong>School<\/strong>/);
  assert.match(html, /You're In/);
  assert.match(html, /That’s it! You’ve been entered into the giveaway\./);
});

test("result screen turns giveaway completion into a personalized shopping handoff", () => {
  assert.match(html, /function getRecommendation\(\)/);
  assert.match(html, /Your Vessi match:/);
  assert.match(html, /Shop my Vessi match/);
  assert.match(html, /Don’t wait for the draw/);
  assert.match(html, /state\.country === "canada" \? "https:\/\/ca\.vessi\.com" : "https:\/\/vessi\.com"/);
  assert.match(html, /addAttributionToUrl/);
  assert.doesNotMatch(html, /discount|coupon|promo code/i);
});

test("question photography renders at its full source composition", () => {
  assert.match(styles, /\.question-accent\s*{[\s\S]*?aspect-ratio:\s*40\s*\/\s*11;[\s\S]*?height:\s*auto;/);
  assert.match(styles, /\.question-accent img\s*{[\s\S]*?object-fit:\s*contain;/);
  assert.doesNotMatch(styles, /\.question-accent--teacher-workday img/);
  assert.doesNotMatch(styles, /\.shell\.quiz-started \.question-accent\s*{[\s\S]*?height:\s*120px;/);
});

test("landing and result photography uses full-image containment", () => {
  assert.match(styles, /\.media-card img\s*{[\s\S]*?object-fit:\s*contain;/);
  assert.match(styles, /\.media-card\.product img\s*{[\s\S]*?max-height:\s*80%;/);
  assert.match(styles, /\.lifestyle-art\s*{[\s\S]*?object-fit:\s*contain;/);
  assert.match(styles, /\.image-strip img\s*{[\s\S]*?object-fit:\s*contain;/);
});

test("customer copy avoids internal funnel and scoring language", () => {
  assert.doesNotMatch(html, /Purchase timing/);
  assert.doesNotMatch(html, /mostly entering the giveaway/);
  assert.doesNotMatch(html, /Result ready/);
  assert.doesNotMatch(html, /You are outside the giveaway rules/);
});

test("eligibility selectors exactly match the Typeform", () => {
  assert.match(html, /"Delaware"/);
  assert.doesNotMatch(html, /"District of Columbia"/);
  assert.match(html, /"Hawaii"/);
  assert.match(html, /"Wyoming"/);
  assert.match(html, /"Northwest Territories"/);
  assert.match(html, /"Nunavut"/);
  assert.doesNotMatch(html, /"Quebec"/);
});

test("users can go back and see their previous selection", () => {
  assert.match(html, /class="back-control"/);
  assert.match(html, /showInlineBack/);
  assert.match(html, /class="option \$\{selectedValue === option\.value \? "is-selected"/);
  assert.match(html, /aria-pressed="\$\{selectedValue === option\.value\}"/);
});

test("entry forms mirror Typeform fields and expose accessible errors", () => {
  assert.match(html, /type:\s*"tel"/);
  assert.match(html, /required:\s*false/);
  assert.doesNotMatch(html, /id="smsOptIn"/);
  assert.match(html, /aria-describedby="formError"/);
  assert.match(html, /role="alert" aria-live="polite"/);
  assert.match(html, /button\("Submit", "results"\)/);
});

test("motion preferences are respected", () => {
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
});
