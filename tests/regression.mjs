// Regression checks for the Chart Transposer.
// Loads index.html in a simulated browser (jsdom), pastes test charts in,
// and checks the transposed output. Run with: node tests/regression.mjs
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const KEY = { C: 0, F: 5, G: 7 }; // option index in the key menus

let failures = 0;
const pass = (name) => console.log(`  ok   ${name}`);
const fail = (name, detail) => { failures++; console.log(`  FAIL ${name}\n       ${detail}`); };

function transpose(text, from = "C", to = "G") {
  const dom = new JSDOM(html, { runScripts: "dangerously" });
  const { document, Event } = dom.window;
  document.getElementById("from").value = KEY[from];
  document.getElementById("to").value = KEY[to];
  const input = document.getElementById("input");
  input.value = text;
  input.dispatchEvent(new Event("input"));
  const out = document.getElementById("output");
  return { text: out.textContent, html: out.innerHTML };
}

function expect(name, text, want, from, to) {
  const got = transpose(text, from, to).text;
  got === want ? pass(name) : fail(name, `expected ${JSON.stringify(want)}\n       got      ${JSON.stringify(got)}`);
}

console.log("Chord transposing (C to G)");
expect("slash chords", "C/E  D/F#  Am7/G  Cmaj7/E", "G/B  A/C#  Em7/D  Gmaj7/B");
expect("borrowed chords keep flats", "Fm/Ab  Bb  Eb/G", "Cm/Eb  F   Bb/D");
expect("lyric line starting 'Am I' is unchanged", "Am I the one", "Am I the one");
expect("bracketed chords", "[C]Words [Am]here", "[G]Words [Em]here");
expect("markers are kept", "| C  Am | F  G | x2", "| G  Em | C  D | x2");

console.log("Chord transposing (C to F)");
expect("C to F spelling", "D/F#  Ab  E7", "G/B   Db  A7", "C", "F");

console.log("Alignment");
expect(
  "tabs keep chords over the same words",
  "C\tAm\tF\tG\nwords\there\tand\tthere",
  "G       Em      C       D\nwords   here    and     there"
);
{
  const src = "C       F       G\nOne     two     three";
  const lines = transpose(src).text.split("\n");
  const cols = (l) => [...l.matchAll(/\S+/g)].map((m) => m.index);
  JSON.stringify(cols(lines[0])) === JSON.stringify(cols(lines[1]))
    ? pass("chords start at the same columns as the words")
    : fail("chords start at the same columns as the words", JSON.stringify(lines));
}

console.log("Safety");
{
  const out = transpose('<img src=x onerror="alert(1)"> [C]la').html;
  !/<img/i.test(out) ? pass("pasted HTML is escaped, never run") : fail("pasted HTML is escaped, never run", out);
}
{
  const banned = [/\bfetch\s*\(/, /XMLHttpRequest/, /navigator\.sendBeacon/, /new\s+WebSocket/];
  const hit = banned.find((re) => re.test(html));
  !hit ? pass("no network calls in the page") : fail("no network calls in the page", `found ${hit}`);
}
{
  const urls = [...html.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)/g)].map((m) => m[1]);
  const bad = urls.filter((u) => !/^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/.test(u));
  !bad.length ? pass("only Google Fonts loaded from outside") : fail("only Google Fonts loaded from outside", bad.join(", "));
}
{
  /<!--\s*Chart Transposer v\d+\.\d+\.\d+\s*-->/.test(html)
    ? pass("version comment present")
    : fail("version comment present", "missing <!-- Chart Transposer vX.Y.Z --> near the top");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
