# Personal portfolio page

Build a one-page site about you with plain HTML, CSS, and a sprinkle of JavaScript — no framework, no build step, just files you can open in a browser. By the end you'll have something real to show, and you'll actually understand every line of it because you wrote it yourself.

**Difficulty:** starter · **Est. days:** 3 · **Stack:** html, css, javascript (vanilla) · **Tracks:** frontend, browser

## Deliverable

A responsive single-page portfolio (hero, about, projects, contact) that looks good on phone and laptop and has one small piece of interactivity you wired up with JavaScript — opened straight from an index.html file.

## Why this project

There's a particular joy in your first real web page — files you can open with a double-click, no toolchain, no framework, just HTML telling the browser what things are, CSS telling it how they look, and JavaScript telling it how to react. Build this and you'll have two things at once: something concrete to show people, and a gut-level feel for the three languages the whole web is made of. Don't rush to add tools you've heard senior people use. The point of week one is to see, with your own hands, how a browser turns plain text into a page.

## Skills

- semantic HTML structure
- CSS layout with flexbox
- responsive design with media queries
- selecting elements and handling a click in JavaScript

## Milestones

### 1. Structure it in HTML

Start with the skeleton: a single index.html with clear, meaningful sections — a header with your name, an 'about' paragraph, a list of two or three projects, and a contact link. Use real semantic tags (header, main, section, nav, footer) instead of a pile of divs. No styling yet: a plain black-on-white page that already reads top to bottom and makes sense is the win here. Open the file directly in your browser to see it.

**Definition of done:**

- An index.html opens in the browser and shows your name, an about paragraph, a project list, and a contact link.
- The page uses semantic elements (header/main/section/footer), not just nested divs.

### 2. Style it with CSS

Link a stylesheet and make the page yours: pick a font, a couple of colors, comfortable spacing, and lay the sections out with flexbox so things line up instead of stacking awkwardly. Aim for calm and readable, not flashy. The skill you're building is seeing a page as boxes you can size, space, and align — once that clicks, every layout gets easier.

**Definition of done:**

- A linked CSS file sets typography, colors, and spacing, and at least one section is laid out with flexbox.
- The page looks intentional and readable, not like an unstyled default document.

### 3. Make it work on a phone

Most people will see your page on a phone, so it has to hold up at narrow widths. Add the viewport meta tag, then use a media query to adjust layout for small screens — stack columns, shrink the hero, bump up the spacing. Resize the browser window and watch it adapt. Responsive isn't a separate page; it's the same HTML choosing to lay out differently when there's less room.

**Definition of done:**

- The page has a viewport meta tag and at least one media query that changes the layout on narrow screens.
- At a phone-sized width, nothing overflows horizontally and the content stays readable.

### 4. Bring it to life with JavaScript

Add one small interactive touch with vanilla JavaScript — a dark-mode toggle, a 'copy email' button, or a mobile menu that opens and closes. Select the element, listen for a click, and change something on the page in response. Keep it to a single feature done well. This is the core loop of all frontend interactivity: find an element, react to an event, update the DOM. Get it once and the rest is just more of the same.

**Definition of done:**

- Clicking your control visibly changes the page (theme, copied state, or open/closed menu).
- The JavaScript selects elements and attaches a click handler — no inline onclick in the HTML.

## Rubric

### Semantic HTML & accessibility

- **Junior:** Sections exist and the page reads top-to-bottom; generic div wrappers are used where semantic elements would be more appropriate.
- **Mid:** header / main / section / nav / footer are used correctly; images have alt text, links are keyboard-navigable, and contrast meets WCAG AA (≥4.5:1 for body text).
- **Senior:** The interactive element (toggle / menu) is keyboard-operable with visible focus, the correct ARIA role and aria-expanded / aria-controls attributes, and the page passes an axe-core or Lighthouse accessibility audit with no critical violations.

### Responsive layout without overflow

- **Junior:** A viewport meta tag is present; the page is narrowable but some elements overflow or text becomes unreadably small on phone widths.
- **Mid:** At least one media query adjusts layout for small screens; nothing overflows horizontally at phone width (320 px) and all content stays readable.
- **Senior:** Layout uses intrinsic sizing (min-content / max-content / clamp) or fluid units so breakpoints are the exception rather than the rule; the page is tested at 320, 768, and 1440 px with zero overflow and correct tap-target size (≥44 px) for interactive elements.

### Performance budget & CWV

- **Junior:** The page loads but images have no explicit dimensions (CLS risk), fonts block rendering, and no Lighthouse or PageSpeed data has been collected.
- **Mid:** Images have explicit width/height (no CLS), fonts use font-display: swap, and a Lighthouse run shows LCP < 2.5 s and CLS < 0.1 on a mobile simulation.
- **Senior:** The hero image is preloaded with fetchpriority='high', below-fold images use loading='lazy', the page is deployed and a real PageSpeed / CrUX run confirms the CWV targets (LCP < 2.5 s, CLS < 0.1, no layout shift from font swap). You can name which resource set each CWV and what would break the budget.

## Senior stretch

- Deploy it for free (GitHub Pages, Netlify, or Cloudflare Pages) so it has a real URL you can put on your resume.
- Run a quick accessibility and Lighthouse pass: check colour contrast, add alt text to images, and make sure the page is fully usable with the keyboard.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/personal-portfolio-page
