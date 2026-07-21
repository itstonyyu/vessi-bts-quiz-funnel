import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const requiredCopy = [
  "We're giving away 200 Pairs of Vessis",
  "to teachers and students.",
  "→ 1 Grand prize: Weekend Neo + Weekend Slip-On.",
  "→ First 100 entries win a pair of Weekend Neos, 100 winners are chosen at random.",
  "Enter to win",
  "Are you a student or educator?",
  "Education professionals include daycare staff, teachers, tutors, TAs, and homeschool educators.",
  "What school do you attend?",
  "How much do you walk each day?",
  "What do you wear when it's raining?",
  "What goes wrong on rainy days?",
  "Meet Vessi: waterproof sneakers for rainy days.",
  "They keep your feet dry, breathable, and comfortable all day.",
  "What would make rainy days easier?",
  "When do you buy school shoes?",
  "Where do you work?",
  "How long are you on your feet each day?",
  "What goes wrong?",
  "Meet Vessi: waterproof sneakers for school days.",
  "Which country are you in?",
  "Open to the US and Canada, excluding Quebec.",
  "What state?",
  "What province?",
  "What's your first name?",
  "And your last name?",
  "What's your email?",
  "Required. We'll email the results and extra perks.",
  "What's your phone number?",
  "Optional.",
  "Are you 18 or older?",
  "Under 18 years",
  "18+",
  "Do you accept this Giveaway's",
  "terms and conditions?",
  "You're In",
  "That’s it! You’ve been entered into the giveaway. Results will be sent via email on August 9th.",
  "This giveaway is only open to eligible Teachers or Students in US or Canada at this time."
];

test("source uses the approved simplified copy", () => {
  for (const copy of requiredCopy) assert.ok(html.includes(copy), `missing exact Typeform copy: ${copy}`);
});

test("student and education-professional answers reproduce the Typeform", () => {
  const choices = [
    "Education Professional", "Student", "Under 15 minutes", "15-30 minutes", "30-60 minutes", "Over an hour",
    "Regular sneakers", "White sneakers", "Boots", "Flats/Loafers", "Whatever matches my outfit",
    "Wet socks", "Long walks in uncomfortable shoes", "Shoes getting dirty", "Having to choose between style and staying dry", "Carrying or changing into another pair",
    "A waterproof sneaker that still looks good", "Comfort for walking across campus", "A breathable shoe I can wear all day", "Easy-clean shoes for bad weather", "One pair that works for class, errands, and going out",
    "Before the semester starts", "During orientation week", "Once I know my campus routine", "When my current pair gives out", "When I find a good deal",
    "Under 4 hours", "4-6 hours", "6-8 hours", "8+ hours", "Flats or loafers", "Bulky rain boots", "An old pair I don't mind wrecking", "I bring a backup pair just in case",
    "My socks get wet", "My feet feel sore", "My shoes get dirty", "I get stuck wearing clunky rain shoes all day", "I avoid wearing the shoes I actually like",
    "Waterproof sneakers that still look good", "Breathable comfort that does not feel like rain boots", "Lightweight support for long days on your feet", "Easy-clean shoes for spills, recess, and messy weather", "One pair that works at school and after school",
    "In summer before school starts", "At the start of the school year", "When my current pair wears out", "Whenever I find something I like", "Right after one rainy day reminds me I need them"
  ];
  for (const choice of choices) assert.ok(html.includes(choice), `missing Typeform answer: ${choice}`);
});

test("flow order matches Typeform and excludes assistant-authored result/profile screens", () => {
  assert.match(html, /if \(current === "role"\)[\s\S]*state\.role === "student" \? "student_school" : "teacher_school"/);
  assert.match(html, /if \(current === "student_intent"\) return pushStep\("country"\)/);
  assert.match(html, /if \(current === "teacher_intent"\) return pushStep\("country"\)/);
  assert.match(html, /if \(current === "age"\)[\s\S]*under18[\s\S]*return pushStep\("terms"\)/);
  assert.doesNotMatch(html, /Your campus match|Your school-day match|Shop my match|Your quiz profile/);
});

test("Typeform eligibility lists are exact", () => {
  assert.ok(html.includes('"Wyoming"'));
  assert.ok(!html.includes('"District of Columbia"'));
  assert.ok(!html.includes('"Quebec"'));
  for (const territory of ["Northwest Territories", "Nunavut", "Yukon"]) assert.ok(html.includes(territory));
});

test("Typeform legal destination is preserved", () => {
  assert.ok(html.includes("https://ca.vessi.com/pages/terms-conditions-teachers-giveaway-2023"));
});

test("giveaway terms are preselected without opting users into marketing", () => {
  assert.match(html, /terms_initialized: false/);
  assert.match(html, /if \(!state\.terms_initialized\) \{ state\.terms_accepted = true; state\.terms_initialized = true; syncUpdate\(\); \}/);
  assert.match(html, /id="termsCheck"[^>]*\$\{state\.terms_accepted \? "checked" : ""\}/);
  assert.match(html, /state\.marketing_consent = false/);
  assert.doesNotMatch(html, /terms_initialized[\s\S]{0,200}marketing_consent = true/);
});
