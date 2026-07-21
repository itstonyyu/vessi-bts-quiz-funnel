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
  "Are you a Student or an Education Professional?",
  "*Must currently work in education sector in the following capacities: Daycare staff, elementary teachers, junior high teachers, high school teachers, post-secondary teachers, tutors, TA's, and home school teachers.",
  "What school are you enrolled in or currently attending?",
  "How much do you usually walk around campus in a day?",
  "What do you currently wear to class when it rains?",
  "What tends to go wrong on rainy campus days?",
  "Meet Vessi: waterproof sneakers built for campus weather.",
  "They look like everyday sneakers, but they are designed to keep your feet dry, breathable, and comfortable through rain, puddles, long walks, class, errands, and plans after school.",
  "Which Vessi feature would make campus days easier?",
  "When do you usually buy shoes for the school year?",
  "What Education Center are you employed by?",
  "How long are you usually on your feet during a school day?",
  "What do you currently wear to school when it rains?",
  "What tends to go wrong with that option?",
  "Meet Vessi: waterproof sneakers made for real school days.",
  "They look like everyday sneakers, but they are built to keep your feet dry, comfortable, and breathable through rainy commutes, wet floors, recess duty, spills, and full days on your feet.",
  "Which Vessi feature would make your school day better?",
  "When do you usually buy back-to-school shoes?",
  "Which country are you joining from?",
  "this giveaway is only open to US &amp; CA participants at this time, excluding Quebec.",
  "What state?",
  "What province?",
  "Great, what's your first name?",
  "and last name?",
  "Your email address",
  "*Required. This is how we’ll send you the results + extra perks",
  "and your phone number",
  "So you'll be sure not to miss the results! Not Required.",
  "Select your age range.",
  "Under 18 years",
  "18+",
  "Do you accept this Giveaway's",
  "terms and conditions?",
  "You're In",
  "That’s it! You’ve been entered into the giveaway. Results will be sent via email on August 9th.",
  "This giveaway is only open to eligible Teachers or Students in US or Canada at this time."
];

test("source reproduces the Typeform copy", () => {
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
