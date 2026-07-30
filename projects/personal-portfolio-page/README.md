# Personal portfolio page — starter

This workbench grades **your page**.

1. Build it in `artifact/`: `index.html`, plus `style.css` and `main.js` (or inline
   them in the HTML — a single file is a fine answer; the grader counts both).
2. Run the checks:

       bun test

`src/page.ts` is the grader; you do not edit it. What starts in `artifact/` is the
first draft nearly everyone writes: it renders, and that is all. No `lang`, no
viewport meta, `div` soup instead of sections, an image with no `alt`, a fixed
960px width, and `outline: none` on links.

Every failing check is something a visitor would hit, not a style opinion:

- No viewport meta ⇒ a phone shows the desktop layout scaled to unreadable.
- No `lang` ⇒ a screen reader guesses the pronunciation.
- Missing `alt` ⇒ the image does not exist for some readers (`alt=""` is the right
  answer for decoration, and passes).
- `outline: none` with no replacement ⇒ keyboard users cannot see where they are.
- `target="_blank"` without `rel="noopener"` ⇒ the opened page can reach into yours.
- A skipped heading level ⇒ the document outline stops being navigable.

The grader reads source; it cannot tell you the page looks good. That part is yours —
open it in a browser at 360px and at laptop width, and tab through it start to finish.
