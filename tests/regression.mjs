// Regression checks for the Chart Transposer.
// Loads index.html in a simulated browser (jsdom), pastes test charts in,
// and checks the transposed output. Run with: node tests/regression.mjs
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const KEY = { C: 0, F: 5, G: 7, A: 9 }; // option index in the key menus

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

console.log("Spelling of borrowed chords");
expect("natural notes the key sharpens spell flat (A to G)", "A  G  D  C  F", "G  F  C  Bb Eb", "A", "G");

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

console.log("Charts typed in Word (tabs + proportional font)");
{
  // Recreate how someone lines chords up in Word (Calibri 11 pt, tab stops every
  // half inch): tabs, then spaces, until the chord sits over the target word.
  const chars = JSON.parse(html.match(/const WORD_CHARS = (".*?");/)[1]);
  const vals = JSON.parse(html.match(/const WORD_FONTS = (\{.*?\});/)[1]).Calibri.split(",").map(Number);
  const w = Object.fromEntries([...chars].map((c, i) => [c, vals[i]]));
  const PT = 11, TAB = 36, adv = (ch) => ((w[ch] ?? w.n) / 1000) * PT;
  const xOf = (s) => [...s].reduce((x, ch) => (ch === "\t" ? (Math.floor(x / TAB + 1e-9) + 1) * TAB : x + adv(ch)), 0);
  function wordLine(lyric, targets) {
    let line = "";
    for (const [chord, word] of targets) {
      const target = xOf(lyric.slice(0, lyric.indexOf(word)));
      while ((Math.floor(xOf(line) / TAB + 1e-9) + 1) * TAB <= target + 0.01) line += "\t";
      while (xOf(line) + adv(" ") / 2 < target) line += " ";
      line += chord;
    }
    return line;
  }
  const song = [
    ["Morning comes along the river road tonight", [["C", "Morning"], ["F", "river"], ["G", "tonight"]]],
    ["Every lantern burning slowly down the hill", [["C", "Every"], ["Am", "burning"], ["F", "hill"]]],
    ["We will carry all the music we can hold", [["F", "carry"], ["G", "music"], ["C", "hold"]]],
    ["Singing softly, leaving nothing left to say", [["Am", "softly,"], ["Dm7", "nothing"], ["G7", "say"]]],
  ];
  const chart = song.map(([lyric, t]) => wordLine(lyric, t) + "\n" + lyric).join("\n");
  const out = transpose(chart).text.split("\n");
  const problems = [];
  song.forEach(([lyric, t], i) => {
    const chordLine = out[2 * i], lyricOut = out[2 * i + 1];
    const cols = [...chordLine.matchAll(/\S+/g)].map((m) => m.index);
    t.forEach(([, word], k) => { if (cols[k] !== lyricOut.indexOf(word)) problems.push(`"${word}": chord at ${cols[k]}, word at ${lyricOut.indexOf(word)}`); });
  });
  !problems.length ? pass("each chord lands on the same word as in Word") : fail("each chord lands on the same word as in Word", problems.join("; "));
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
