-- =============================================================================
-- Lumina bespoke custom-render site
--
-- Replaces the engine-rendered lumina demo with a fully bespoke multi-page
-- site (render_mode = 'custom', inline mode): home, /about, /craft.
-- Design: atelier ledger aesthetic — plaster/ink/brass, Fraunces + Manrope,
-- hand-drawn elevation plates, pure-CSS before/after reveal, dark quote
-- section hosting the calculator widget. Widget theme switched to
-- 'ivory-brass' to match the palette.
-- =============================================================================

do $demo$
declare
  lumina_tid uuid;
begin
  select t.id into lumina_tid
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) in ('lumina.ditchtheform.com', 'lumina.closetquotes.com', 'lumina.localhost')
  order by case when d.hostname like '%.ditchtheform.com' then 0 else 1 end
  limit 1;

  if lumina_tid is null then
    raise exception 'Lumina demo tenant not found';
  end if;

  update public.site_configs
  set
    render_mode = 'custom',
    custom_config = jsonb_build_object(
      'mode', 'inline',
      'globalCss', $lum_css$
/* == Lumina Custom Closets — bespoke site global CSS ==
   Scoped by platform under [data-custom-site]; body/html/:root selectors are
   rewritten to the scope div. Palette: plaster / ink / brass. */

body {
  background: #f3efe8;
  color: #241f1a;
  font-family: var(--font-manrope), 'Helvetica Neue', Arial, sans-serif;
  font-size: 17px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

.lum * , .lum *::before, .lum *::after { box-sizing: border-box; margin: 0; padding: 0; }

.lum {
  --plaster: #f3efe8;
  --paper: #faf7f1;
  --ink: #241f1a;
  --ink-soft: #4d453c;
  --mute: #7a7065;
  --brass: #8a7256;
  --brass-deep: #6e5a42;
  --hair: rgba(36, 31, 26, 0.14);
  --hair-soft: rgba(36, 31, 26, 0.08);
  background: var(--plaster);
  color: var(--ink);
}

.lum a { color: inherit; text-decoration: none; }
.lum img { display: block; max-width: 100%; height: auto; }

.lum .serif { font-family: var(--font-fraunces), Georgia, 'Times New Roman', serif; }

/* ---------- header ---------- */
.lum-head {
  position: sticky; top: 0; z-index: 60;
  background: rgba(243, 239, 232, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--hair-soft);
}
.lum-head-in {
  max-width: 1320px; margin: 0 auto; padding: 0 28px;
  height: 76px; display: flex; align-items: center; gap: 40px;
}
.lum-mark {
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: 21px; letter-spacing: 0.01em; font-weight: 600;
  display: flex; align-items: baseline; gap: 10px;
}
.lum-mark small {
  font-family: var(--font-manrope), sans-serif;
  font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase;
  color: var(--mute); font-weight: 600;
}
.lum-nav { margin-left: auto; display: flex; align-items: center; gap: 34px; }
.lum-nav a {
  font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase;
  font-weight: 600; color: var(--ink-soft);
  padding: 6px 0; border-bottom: 1px solid transparent;
  transition: color .2s, border-color .2s;
}
.lum-nav a:hover { color: var(--ink); border-color: var(--brass); }
.lum-nav a.is-here { color: var(--ink); border-color: var(--ink); }
.lum-nav .lum-cta {
  border: 1px solid var(--ink); padding: 11px 22px;
  color: var(--ink); transition: background .2s, color .2s;
}
.lum-nav .lum-cta:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }
@media (max-width: 860px) {
  .lum-head-in { height: auto; flex-wrap: wrap; padding: 14px 20px; gap: 12px; }
  .lum-nav { margin-left: 0; width: 100%; gap: 18px; flex-wrap: wrap; }
}

/* ---------- shared shells ---------- */
.lum-wrap { max-width: 1320px; margin: 0 auto; padding-left: 28px; padding-right: 28px; }
.lum-narrow { max-width: 880px; margin: 0 auto; padding-left: 28px; padding-right: 28px; }

.lum-eyebrow {
  font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase;
  font-weight: 700; color: var(--brass);
  display: flex; align-items: center; gap: 14px;
}
.lum-eyebrow::before { content: ""; width: 34px; height: 1px; background: var(--brass); }

.lum h1, .lum h2, .lum h3 {
  font-family: var(--font-fraunces), Georgia, serif;
  font-weight: 500; line-height: 1.08; letter-spacing: -0.01em;
}

.lum-rule { border: 0; border-top: 1px solid var(--hair); }

/* ---------- hero ---------- */
.lum-hero { border-bottom: 1px solid var(--hair-soft); }
.lum-hero-grid {
  display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 0; align-items: stretch;
}
.lum-hero-copy { padding: 96px 64px 96px 28px; display: flex; flex-direction: column; justify-content: center; }
.lum-hero-copy h1 { font-size: clamp(42px, 5.2vw, 74px); margin: 26px 0 26px; }
.lum-hero-copy h1 em { font-style: italic; color: var(--brass-deep); }
.lum-hero-copy p.lede { font-size: 19px; color: var(--ink-soft); max-width: 33em; }
.lum-hero-actions { display: flex; gap: 18px; margin-top: 40px; flex-wrap: wrap; }
.lum-btn {
  display: inline-block; padding: 16px 32px; font-size: 13px;
  letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700;
  border: 1px solid var(--ink); transition: background .2s, color .2s;
}
.lum-btn.solid { background: var(--ink); color: var(--paper); }
.lum-btn.solid:hover { background: transparent; color: var(--ink); }
.lum-btn.ghost { color: var(--ink); }
.lum-btn.ghost:hover { background: var(--ink); color: var(--paper); }
.lum-hero-media { position: relative; min-height: 560px; }
.lum-hero-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.lum-hero-plate {
  position: absolute; left: -72px; bottom: 48px; width: 300px;
  background: var(--paper); border: 1px solid var(--hair);
  box-shadow: 0 24px 48px -24px rgba(36,31,26,.35);
  padding: 10px;
}
.lum-hero-plate img { position: static; height: auto; }
.lum-hero-plate figcaption {
  font-size: 10px; letter-spacing: .22em; text-transform: uppercase;
  color: var(--mute); padding: 10px 6px 4px; display: flex; justify-content: space-between;
}
.lum-hero-facts {
  display: flex; gap: 0; margin-top: 56px; border-top: 1px solid var(--hair);
}
.lum-hero-facts div { padding: 20px 32px 0 0; margin-right: 32px; }
.lum-hero-facts div + div { border-left: 1px solid var(--hair); padding-left: 32px; }
.lum-hero-facts strong {
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: 26px; font-weight: 500; display: block;
}
.lum-hero-facts span { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--mute); }
@media (max-width: 1020px) {
  .lum-hero-grid { grid-template-columns: 1fr; }
  .lum-hero-copy { padding: 64px 28px 48px; }
  .lum-hero-media { min-height: 420px; }
  .lum-hero-plate { left: 20px; width: 240px; }
}

/* ---------- section scaffolding ---------- */
.lum-sec { padding: 110px 0; }
.lum-sec.tint { background: var(--paper); border-top: 1px solid var(--hair-soft); border-bottom: 1px solid var(--hair-soft); }
.lum-sec-head { max-width: 720px; margin-bottom: 64px; }
.lum-sec-head h2 { font-size: clamp(30px, 3.4vw, 46px); margin-top: 22px; }
.lum-sec-head p { color: var(--ink-soft); margin-top: 18px; font-size: 18px; }

/* ---------- editorial split ---------- */
.lum-split { display: grid; grid-template-columns: 5fr 7fr; gap: 72px; align-items: start; }
.lum-split.rev { grid-template-columns: 7fr 5fr; }
.lum-split .sticky { position: sticky; top: 110px; }
.lum-split h2 { font-size: clamp(28px, 3vw, 42px); margin-top: 22px; }
.lum-split p { color: var(--ink-soft); margin-top: 18px; }
@media (max-width: 1020px) { .lum-split, .lum-split.rev { grid-template-columns: 1fr; gap: 40px; } }

/* ---------- drawings / plates ---------- */
.lum-plate {
  background: var(--paper); border: 1px solid var(--hair); padding: 18px;
}
.lum-plate figcaption {
  display: flex; justify-content: space-between; gap: 16px;
  font-size: 10px; letter-spacing: .22em; text-transform: uppercase;
  color: var(--mute); padding: 14px 4px 2px;
}

/* pure-CSS reveal: drag the handle at lower-right of the top sheet */
.lum-compare { position: relative; border: 1px solid var(--hair); background: var(--paper); }
.lum-compare > img { width: 100%; }
.lum-compare-top {
  position: absolute; inset: 0 auto 0 0; width: 55%; min-width: 12%; max-width: 100%;
  resize: horizontal; overflow: hidden;
  border-right: 2px solid var(--brass);
  background: var(--paper);
}
.lum-compare-top img {
  width: 100%; height: 100%; object-fit: cover; object-position: left center; max-width: none;
}
.lum-compare-top::after {
  content: "⟺ drag"; position: absolute; right: 8px; bottom: 8px;
  font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
  background: var(--ink); color: var(--paper); padding: 6px 10px;
  pointer-events: none;
}
.lum-tag {
  position: absolute; top: 14px; font-size: 10px; letter-spacing: .2em;
  text-transform: uppercase; font-weight: 700; padding: 6px 12px;
}
.lum-tag.before { right: 14px; background: var(--paper); border: 1px solid var(--hair); color: var(--ink-soft); }
.lum-tag.after { left: 14px; background: var(--ink); color: var(--paper); }

/* ---------- ledger table ---------- */
.lum-ledger { width: 100%; border-collapse: collapse; }
.lum-ledger th {
  text-align: left; font-size: 11px; letter-spacing: .24em; text-transform: uppercase;
  color: var(--mute); font-weight: 700; padding: 0 20px 16px 0;
  border-bottom: 1px solid var(--ink);
}
.lum-ledger td {
  padding: 22px 20px 22px 0; border-bottom: 1px solid var(--hair);
  vertical-align: top; font-size: 16px; color: var(--ink-soft);
}
.lum-ledger td:first-child {
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: 19px; color: var(--ink); white-space: nowrap;
}
.lum-ledger .num {
  font-size: 12px; letter-spacing: .18em; color: var(--brass); display: block; margin-bottom: 6px;
}

/* ---------- work gallery ---------- */
.lum-work { display: grid; grid-template-columns: repeat(12, 1fr); gap: 28px; }
.lum-work figure { position: relative; }
.lum-work figure:nth-child(1) { grid-column: 1 / span 7; }
.lum-work figure:nth-child(2) { grid-column: 8 / span 5; margin-top: 84px; }
.lum-work figure:nth-child(3) { grid-column: 2 / span 5; margin-top: -40px; }
.lum-work figure:nth-child(4) { grid-column: 7 / span 6; margin-top: 48px; }
.lum-work img { border: 1px solid var(--hair); }
.lum-work figcaption {
  margin-top: 14px; display: flex; justify-content: space-between; gap: 16px;
  font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--mute);
}
.lum-work figcaption b { color: var(--ink); font-weight: 600; }
@media (max-width: 860px) {
  .lum-work { grid-template-columns: 1fr; }
  .lum-work figure { grid-column: 1 / -1 !important; margin-top: 0 !important; }
}

/* ---------- testimonials ---------- */
.lum-quotes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1px solid var(--hair); background: var(--paper); }
.lum-quotes blockquote { padding: 44px 40px; }
.lum-quotes blockquote + blockquote { border-left: 1px solid var(--hair); }
.lum-quotes p {
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: 19px; line-height: 1.45; color: var(--ink);
}
.lum-quotes footer { margin-top: 22px; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--mute); }
.lum-quotes footer b { color: var(--ink); font-weight: 700; }
@media (max-width: 1020px) {
  .lum-quotes { grid-template-columns: 1fr; }
  .lum-quotes blockquote + blockquote { border-left: 0; border-top: 1px solid var(--hair); }
}

/* ---------- quote (widget) section ---------- */
.lum-quote-sec { background: var(--ink); color: #efe9df; }
.lum-quote-sec .lum-eyebrow { color: #c2a67f; }
.lum-quote-sec .lum-eyebrow::before { background: #c2a67f; }
.lum-quote-sec h2 { color: #f6f2ec; }
.lum-quote-grid { display: grid; grid-template-columns: 5fr 7fr; gap: 72px; align-items: start; }
.lum-quote-side p { color: rgba(239, 233, 223, 0.78); margin-top: 18px; }
.lum-quote-side .lum-ledgerette { margin-top: 40px; border-top: 1px solid rgba(246,242,236,.25); }
.lum-ledgerette div { display: flex; justify-content: space-between; gap: 20px; padding: 16px 0; border-bottom: 1px solid rgba(246,242,236,.14); font-size: 14px; }
.lum-ledgerette span { color: rgba(239,233,223,.6); letter-spacing: .1em; text-transform: uppercase; font-size: 11px; padding-top: 3px; }
.lum-ledgerette b { font-weight: 600; color: #f6f2ec; text-align: right; }
.lum-quote-mount { background: var(--paper); border: 1px solid rgba(246,242,236,.2); padding: 12px; color: var(--ink); }
@media (max-width: 1020px) { .lum-quote-grid { grid-template-columns: 1fr; gap: 44px; } }

/* ---------- footer ---------- */
.lum-foot { background: var(--ink); color: rgba(239,233,223,.65); border-top: 1px solid rgba(246,242,236,.12); }
.lum-foot-in {
  max-width: 1320px; margin: 0 auto; padding: 64px 28px 40px;
  display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px;
}
.lum-foot h4 {
  font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
  color: #c2a67f; margin-bottom: 18px; font-weight: 700;
}
.lum-foot a { display: block; padding: 5px 0; font-size: 15px; color: rgba(239,233,223,.72); }
.lum-foot a:hover { color: #f6f2ec; }
.lum-foot .mark { font-family: var(--font-fraunces), Georgia, serif; font-size: 22px; color: #f6f2ec; }
.lum-foot .fine {
  max-width: 1320px; margin: 0 auto; padding: 22px 28px 40px;
  border-top: 1px solid rgba(246,242,236,.12);
  font-size: 12px; letter-spacing: .06em; display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap;
}
@media (max-width: 860px) { .lum-foot-in { grid-template-columns: 1fr 1fr; } }

/* ---------- page hero (interior pages) ---------- */
.lum-page-hero { padding: 96px 0 72px; border-bottom: 1px solid var(--hair-soft); }
.lum-page-hero h1 { font-size: clamp(38px, 4.6vw, 64px); margin-top: 24px; max-width: 15em; }
.lum-page-hero p { font-size: 19px; color: var(--ink-soft); margin-top: 22px; max-width: 34em; }

/* ---------- numbered method ---------- */
.lum-method { counter-reset: step; display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.lum-method article { border: 1px solid var(--hair); background: var(--paper); padding: 36px 32px 40px; position: relative; }
.lum-method article::before {
  counter-increment: step; content: "0" counter(step);
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: 44px; color: var(--brass); display: block; margin-bottom: 18px;
}
.lum-method h3 { font-size: 22px; margin-bottom: 12px; }
.lum-method p { color: var(--ink-soft); font-size: 15.5px; }
.lum-method em { display:block; margin-top: 16px; font-style: normal; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--mute); }
@media (max-width: 1020px) { .lum-method { grid-template-columns: 1fr; } }

/* ---------- letter block (about) ---------- */
.lum-letter {
  background: var(--paper); border: 1px solid var(--hair);
  padding: 72px; max-width: 820px;
}
.lum-letter p { font-family: var(--font-fraunces), Georgia, serif; font-size: 20px; line-height: 1.7; color: var(--ink); }
.lum-letter p + p { margin-top: 26px; }
.lum-letter .sig { margin-top: 44px; font-family: var(--font-cormorant), Georgia, serif; font-style: italic; font-size: 30px; color: var(--brass-deep); }
.lum-letter .sig small { display: block; font-family: var(--font-manrope), sans-serif; font-style: normal; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--mute); margin-top: 8px; }
@media (max-width: 720px) { .lum-letter { padding: 40px 28px; } }

/* ---------- spec strip ---------- */
.lum-specs { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--hair); background: var(--paper); }
.lum-specs div { padding: 34px 30px; }
.lum-specs div + div { border-left: 1px solid var(--hair); }
.lum-specs strong { font-family: var(--font-fraunces), Georgia, serif; font-size: 30px; font-weight: 500; display: block; }
.lum-specs span { font-size: 11.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--mute); display: block; margin-top: 8px; }
@media (max-width: 1020px) {
  .lum-specs { grid-template-columns: 1fr 1fr; }
  .lum-specs div:nth-child(3) { border-left: 0; }
  .lum-specs div:nth-child(n+3) { border-top: 1px solid var(--hair); }
}

/* ---------- FAQ ---------- */
.lum-faq { max-width: 880px; }
.lum-faq details { border-bottom: 1px solid var(--hair); }
.lum-faq summary {
  cursor: pointer; list-style: none; display: flex; justify-content: space-between; gap: 24px;
  padding: 26px 0; font-family: var(--font-fraunces), Georgia, serif; font-size: 20px;
}
.lum-faq summary::-webkit-details-marker { display: none; }
.lum-faq summary::after { content: "+"; color: var(--brass); font-size: 24px; line-height: 1; }
.lum-faq details[open] summary::after { content: "–"; }
.lum-faq details p { padding: 0 0 26px; color: var(--ink-soft); max-width: 44em; }

/* ---------- finishes ---------- */
.lum-finishes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 22px; }
.lum-finish .chip { height: 130px; border: 1px solid var(--hair); }
.lum-finish h4 { font-size: 15px; margin-top: 14px; font-weight: 600; font-family: var(--font-manrope), sans-serif; }
.lum-finish p { font-size: 12.5px; color: var(--mute); margin-top: 4px; }
@media (max-width: 1020px) { .lum-finishes { grid-template-columns: repeat(2, 1fr); } }

/* ---------- pull band ---------- */
.lum-band { padding: 96px 0; text-align: center; }
.lum-band h2 { font-size: clamp(30px, 3.6vw, 48px); max-width: 20em; margin: 22px auto 0; }
.lum-band .lum-eyebrow { justify-content: center; }
.lum-band .lum-eyebrow::after { content: ""; width: 34px; height: 1px; background: var(--brass); }
.lum-band .lum-btn { margin-top: 36px; }
$lum_css$,
      'pages', jsonb_build_object(
        '/', jsonb_build_object(
          'title', 'Lumina Custom Closets — Measured, drawn, and built in Nashville',
          'description', 'A nine-person Nashville shop. We survey to the quarter-inch, draw the elevation, and build to the signed sheet. Price your closet online.',
          'html', $lum_home$
<div class="lum">
  <header class="lum-head">
    <div class="lum-head-in">
      <a class="lum-mark" href="/">Lumina <small>Custom Closets · Nashville</small></a>
      <nav class="lum-nav">
        <a href="/" class="is-here">The Work</a>
        <a href="/craft">Craft &amp; Process</a>
        <a href="/about">About</a>
        <a class="lum-cta" href="#quote">Price a closet</a>
      </nav>
    </div>
  </header>

  <section class="lum-hero">
    <div class="lum-wrap">
      <div class="lum-hero-grid">
        <div class="lum-hero-copy">
          <p class="lum-eyebrow">Cabinetmakers, est. 2016</p>
          <h1>Every closet we build starts as a <em>drawing.</em></h1>
          <p class="lede">We survey your walls to the quarter-inch, draw the elevation by hand, and build to that sheet — nothing off a shelf, nothing cut before you have signed the drawing.</p>
          <div class="lum-hero-actions">
            <a class="lum-btn solid" href="#quote">Price a closet</a>
            <a class="lum-btn ghost" href="/craft">See how we work</a>
          </div>
          <div class="lum-hero-facts">
            <div><strong>6–8 wks</strong><span>survey to install</span></div>
            <div><strong>1/4&Prime;</strong><span>survey tolerance</span></div>
            <div><strong>Five</strong><span>finish programs</span></div>
          </div>
        </div>
        <div class="lum-hero-media">
          <img src="/brands/lumina/hero.png" alt="Walk-in wardrobe in white oak with integrated 2700K lighting" />
          <figure class="lum-hero-plate">
            <img src="/brands/lumina/wall-after.svg" alt="As-built elevation drawing, job no. 24-0619" />
            <figcaption><span>As-built</span><span>Job 24-0619</span></figcaption>
          </figure>
        </div>
      </div>
    </div>
  </section>

  <section class="lum-sec" id="drawing">
    <div class="lum-wrap">
      <div class="lum-split">
        <div class="sticky">
          <p class="lum-eyebrow">One wall, two sheets</p>
          <h2>The same 6&prime;-6&Prime; niche, surveyed to as-built</h2>
          <p>Job 24-0619 came to us with a single bare bulb, a water stain we had to chase to a flashing leak, and one sagging wire shelf. The left sheet is our field survey from the first visit. Drag the divider to see the sheet the client signed — double-hang rails, a six-drawer stack on soft-close runners, and 2700K strips wired to a dimmer.</p>
          <p>Both sheets stay in the job folder. If a rail is a half-inch off the drawing at install, it comes back to the shop. That has happened twice in nine years; both times it came back.</p>
        </div>
        <figure class="lum-compare">
          <img src="/brands/lumina/wall-before.png" alt="Field survey drawing: bare bulb, water stain, sagging wire shelf" />
          <div class="lum-compare-top">
            <img src="/brands/lumina/wall-after.png" alt="As-built elevation: double-hang, drawer stack, 2700K lighting" />
          </div>
          <span class="lum-tag after">As-built</span>
          <span class="lum-tag before">Field survey</span>
        </figure>
      </div>
    </div>
  </section>

  <section class="lum-sec tint" id="method">
    <div class="lum-wrap">
      <div class="lum-sec-head">
        <p class="lum-eyebrow">Method</p>
        <h2>Three visits. No third-party crews.</h2>
      </div>
      <div class="lum-method">
        <article>
          <h3>The survey</h3>
          <p>One of our two senior fitters lasers every wall, floor slope, and out-of-square corner. Old houses in Richland–West End rarely give us a true wall; we draw what is actually there.</p>
          <em>45 minutes · no charge</em>
        </article>
        <article>
          <h3>The drawing</h3>
          <p>You get a dimensioned elevation with a job number, your finish schedule, and a fixed price on one page. Change anything you like — we redraw until you sign, and the price on the sheet is the price.</p>
          <em>Within five working days</em>
        </article>
        <article>
          <h3>The install</h3>
          <p>Panels arrive cut, edged, and labeled from our shop off Charlotte Ave. Most closets go in inside a day; walk-ins take two. We check the built work against the drawing before we ask you to look.</p>
          <em>1–2 days on site</em>
        </article>
      </div>
    </div>
  </section>

  <section class="lum-sec" id="work">
    <div class="lum-wrap">
      <div class="lum-sec-head">
        <p class="lum-eyebrow">Recent jobs</p>
        <h2>Built work, photographed the week it was handed over</h2>
      </div>
      <div class="lum-work">
        <figure>
          <img src="/brands/lumina/hero.png" alt="Walk-in wardrobe in rift-sawn white oak" />
          <figcaption><b>Belle Meade walk-in</b><span>Job 24-0611 · white oak</span></figcaption>
        </figure>
        <figure>
          <img src="/brands/lumina/product-1.png" alt="Reach-in closet with double-hang and drawer stack" />
          <figcaption><b>12South reach-in</b><span>Job 24-0619 · walnut</span></figcaption>
        </figure>
        <figure>
          <img src="/brands/lumina/product-2.png" alt="Wardrobe wall in matte lacquer" />
          <figcaption><b>Green Hills wardrobe wall</b><span>Job 25-0104 · matte lacquer</span></figcaption>
        </figure>
        <figure>
          <img src="/brands/lumina/product-3.png" alt="Island unit with brushed brass pulls" />
          <figcaption><b>Sylvan Park island</b><span>Job 25-0117 · brass hardware</span></figcaption>
        </figure>
      </div>
    </div>
  </section>

  <section class="lum-sec tint">
    <div class="lum-wrap">
      <div class="lum-sec-head">
        <p class="lum-eyebrow">Clients</p>
        <h2>In their words</h2>
      </div>
      <div class="lum-quotes">
        <blockquote>
          <p>&ldquo;The drawing they left after the survey was worth the wait on its own. What got installed matches it line for line.&rdquo;</p>
          <footer><b>Megan R.</b> — Green Hills</footer>
        </blockquote>
        <blockquote>
          <p>&ldquo;Two fitters, one day, no subcontractors, and they vacuumed the baseboards on the way out. The price never moved from the sheet.&rdquo;</p>
          <footer><b>David K.</b> — Belle Meade</footer>
        </blockquote>
        <blockquote>
          <p>&ldquo;I changed the drawer count twice. They redrew it twice, no sighing, and the second revision came back in a day.&rdquo;</p>
          <footer><b>Priya S.</b> — 12South</footer>
        </blockquote>
      </div>
    </div>
  </section>

  <section class="lum-sec lum-quote-sec" id="quote">
    <div class="lum-wrap">
      <div class="lum-quote-grid">
        <div class="lum-quote-side">
          <p class="lum-eyebrow">Pricing</p>
          <h2>Price your closet before we ever visit</h2>
          <p>Answer a handful of questions about the space and you will get a realistic range — the same arithmetic we use at the survey, not a teaser number. No account, no phone call unless you ask for one.</p>
          <div class="lum-ledgerette">
            <div><span>Survey &amp; drawing</span><b>No charge</b></div>
            <div><span>Typical reach-in</span><b>$2,800 – $4,500</b></div>
            <div><span>Typical walk-in</span><b>$6,500 – $14,000</b></div>
            <div><span>Lead time</span><b>6–8 weeks</b></div>
            <div><span>Warranty</span><b>10 years, hardware included</b></div>
          </div>
        </div>
        <div class="lum-quote-mount">
          <!-- CLOSET_WIDGET -->
        </div>
      </div>
    </div>
  </section>

  <footer class="lum-foot">
    <div class="lum-foot-in">
      <div>
        <p class="mark">Lumina Custom Closets</p>
        <p style="margin-top:14px; font-size:14.5px; max-width:26em;">A nine-person shop off Charlotte Avenue. We measure, draw, build, and install — and nothing gets cut until you have signed the drawing.</p>
      </div>
      <div>
        <h4>Visit</h4>
        <a href="/">The work</a>
        <a href="/craft">Craft &amp; process</a>
        <a href="/about">About the shop</a>
      </div>
      <div>
        <h4>Enquiries</h4>
        <a href="#quote">Price a closet</a>
        <a href="tel:+16155550164">(615) 555-0164</a>
        <a href="mailto:shop@luminaclosets.com">shop@luminaclosets.com</a>
      </div>
      <div>
        <h4>Workshop</h4>
        <a href="#">4218 Charlotte Ave</a>
        <a href="#">Nashville, TN 37209</a>
        <a href="#">Mon–Fri, 7a–4p</a>
      </div>
    </div>
    <div class="fine">
      <span>© 2025 Lumina Custom Closets, LLC · Nashville, Tennessee</span>
      <span>Licensed &amp; insured · TN HIC #78412</span>
    </div>
  </footer>
</div>
$lum_home$,
          'css', ''
        ),
        '/about', jsonb_build_object(
          'title', 'About the shop — Lumina Custom Closets, Nashville',
          'description', 'Founded in 2016 by trim carpenter Rachel Voss. Nine people, one workshop off Charlotte Avenue, and a rule that nothing gets cut unsigned.',
          'html', $lum_about$
<div class="lum">
  <header class="lum-head">
    <div class="lum-head-in">
      <a class="lum-mark" href="/">Lumina <small>Custom Closets · Nashville</small></a>
      <nav class="lum-nav">
        <a href="/">The Work</a>
        <a href="/craft">Craft &amp; Process</a>
        <a href="/about" class="is-here">About</a>
        <a class="lum-cta" href="/#quote">Price a closet</a>
      </nav>
    </div>
  </header>

  <section class="lum-page-hero">
    <div class="lum-wrap">
      <p class="lum-eyebrow">About the shop</p>
      <h1>A nine-person shop that still drives to every survey</h1>
      <p>Lumina began in 2016 as one bench, one truck, and a habit of drawing everything before cutting anything. The habit stayed; the bench count grew.</p>
    </div>
  </section>

  <section class="lum-sec">
    <div class="lum-wrap">
      <div class="lum-split rev">
        <div>
          <figure class="lum-plate">
            <img src="/brands/lumina/product-2.png" alt="Wardrobe wall in matte lacquer, Green Hills" />
            <figcaption><span>Green Hills</span><span>Job 25-0104</span></figcaption>
          </figure>
        </div>
        <div class="sticky">
          <p class="lum-eyebrow">Where we came from</p>
          <h2>Trim carpentry first, closets by accident</h2>
          <p>Rachel Voss spent eleven years running trim crews on custom homes around Franklin before a client asked her to &ldquo;do something about the closets&rdquo; in a 1920s foursquare. She surveyed the room, drew the elevation on graph paper at the kitchen table, and built it in a borrowed shop over two weekends.</p>
          <p>That drawing — creased, coffee-stained — is framed by the shop door on Charlotte Avenue. It reminds everyone here that the sheet is the promise: what we draw is what we owe you.</p>
          <p>Today the shop runs two senior fitters, three bench joiners, a finisher, a draughtsman, and two apprentices. Rachel still checks every drawing before it goes out.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="lum-sec tint">
    <div class="lum-narrow">
      <div class="lum-letter">
        <p>Most closet companies will sell you a system. We never figured out how to do that, because no two walls we survey are the same and we would rather not pretend otherwise.</p>
        <p>What we can promise is narrower and, we think, worth more: a fitter with a laser and a notebook, a drawing with your name and a job number on it, a price that does not move once you sign, and built work that matches the sheet or goes back on the truck.</p>
        <p>If that sounds slow, it is — six to eight weeks, most of the year. The drawing is why. It is also why we have never once argued with a client about what was agreed.</p>
        <p class="sig">Rachel Voss<small>Founder &amp; principal, Lumina Custom Closets</small></p>
      </div>
    </div>
  </section>

  <section class="lum-sec">
    <div class="lum-wrap">
      <div class="lum-sec-head">
        <p class="lum-eyebrow">The shop in numbers</p>
        <h2>Kept honestly since the first job book</h2>
      </div>
      <div class="lum-specs">
        <div><strong>2016</strong><span>First job, Sylvan Park</span></div>
        <div><strong>640+</strong><span>Closets drawn &amp; built</span></div>
        <div><strong>9</strong><span>People, one workshop</span></div>
        <div><strong>2</strong><span>Rebuilds in nine years</span></div>
      </div>
    </div>
  </section>

  <section class="lum-sec tint">
    <div class="lum-wrap">
      <div class="lum-sec-head">
        <p class="lum-eyebrow">What we hold to</p>
        <h2>House rules, posted by the bench</h2>
      </div>
      <table class="lum-ledger">
        <thead><tr><th style="width:30%">Rule</th><th>What it means for you</th></tr></thead>
        <tbody>
          <tr>
            <td><span class="num">No. 1</span>Nothing cut unsigned</td>
            <td>No panel is cut until you have signed the elevation. Revisions before signature are unlimited and free; we would rather redraw than rebuild.</td>
          </tr>
          <tr>
            <td><span class="num">No. 2</span>The sheet is the price</td>
            <td>The number on the signed drawing is what you pay. If we misjudged the labor, that is our lesson, not your invoice.</td>
          </tr>
          <tr>
            <td><span class="num">No. 3</span>Our people, our vans</td>
            <td>Every survey and install is done by Lumina employees. No subcontracted crews, no marketplace installers, no exceptions to date.</td>
          </tr>
          <tr>
            <td><span class="num">No. 4</span>Ten years, in writing</td>
            <td>Carcasses, rails, runners, and hinges are covered for ten years. Call the shop, quote your job number, and we come out.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="lum-band">
    <div class="lum-wrap">
      <p class="lum-eyebrow">Start with a number</p>
      <h2>Price your closet in a few minutes — the survey and drawing are on us</h2>
      <a class="lum-btn solid" href="/#quote">Price a closet</a>
    </div>
  </section>

  <footer class="lum-foot">
    <div class="lum-foot-in">
      <div>
        <p class="mark">Lumina Custom Closets</p>
        <p style="margin-top:14px; font-size:14.5px; max-width:26em;">A nine-person shop off Charlotte Avenue. We measure, draw, build, and install — and nothing gets cut until you have signed the drawing.</p>
      </div>
      <div>
        <h4>Visit</h4>
        <a href="/">The work</a>
        <a href="/craft">Craft &amp; process</a>
        <a href="/about">About the shop</a>
      </div>
      <div>
        <h4>Enquiries</h4>
        <a href="/#quote">Price a closet</a>
        <a href="tel:+16155550164">(615) 555-0164</a>
        <a href="mailto:shop@luminaclosets.com">shop@luminaclosets.com</a>
      </div>
      <div>
        <h4>Workshop</h4>
        <a href="#">4218 Charlotte Ave</a>
        <a href="#">Nashville, TN 37209</a>
        <a href="#">Mon–Fri, 7a–4p</a>
      </div>
    </div>
    <div class="fine">
      <span>© 2025 Lumina Custom Closets, LLC · Nashville, Tennessee</span>
      <span>Licensed &amp; insured · TN HIC #78412</span>
    </div>
  </footer>
</div>
$lum_about$,
          'css', ''
        ),
        '/craft', jsonb_build_object(
          'title', 'Craft & process — Lumina Custom Closets, Nashville',
          'description', 'Materials, hardware, tolerances, and lead times behind every Lumina drawing: 19mm plywood carcasses, soft-close runners, 2700K lighting, ten-year warranty.',
          'html', $lum_craft$
<div class="lum">
  <header class="lum-head">
    <div class="lum-head-in">
      <a class="lum-mark" href="/">Lumina <small>Custom Closets · Nashville</small></a>
      <nav class="lum-nav">
        <a href="/">The Work</a>
        <a href="/craft" class="is-here">Craft &amp; Process</a>
        <a href="/about">About</a>
        <a class="lum-cta" href="/#quote">Price a closet</a>
      </nav>
    </div>
  </header>

  <section class="lum-page-hero">
    <div class="lum-wrap">
      <p class="lum-eyebrow">Craft &amp; process</p>
      <h1>What the drawing commits us to</h1>
      <p>The elevation you sign is a contract in inches. This page is the long version of what stands behind every line on it — materials, hardware, tolerances, and the questions we get asked at the kitchen table.</p>
    </div>
  </section>

  <section class="lum-sec">
    <div class="lum-wrap">
      <div class="lum-split">
        <div class="sticky">
          <p class="lum-eyebrow">The sheet itself</p>
          <h2>Read one of our drawings</h2>
          <p>Every elevation carries the job number, the survey date, the finish schedule, and dimensions to the quarter-inch. Notes in the margin record what the fitter found — a water stain, a bowed stud, an outlet that has to move.</p>
          <p>This is the as-built sheet for job 24-0619. The fitter&rsquo;s survey notes from the first visit are on the companion sheet; both live in the job folder for the life of the warranty.</p>
        </div>
        <figure class="lum-plate">
          <img src="/brands/lumina/wall-after.svg" alt="As-built elevation drawing for job 24-0619 with dimensions and finish schedule" />
          <figcaption><span>As-built elevation</span><span>Job 24-0619 · 6&prime;-6&Prime; niche</span></figcaption>
        </figure>
      </div>
    </div>
  </section>

  <section class="lum-sec tint">
    <div class="lum-wrap">
      <div class="lum-sec-head">
        <p class="lum-eyebrow">Materials &amp; hardware</p>
        <h2>What we build with, and why</h2>
        <p>We standardize where it buys you reliability and stay flexible where it buys you a better room.</p>
      </div>
      <table class="lum-ledger">
        <thead><tr><th style="width:30%">Component</th><th>Specification</th></tr></thead>
        <tbody>
          <tr>
            <td><span class="num">Carcass</span>Cabinet body</td>
            <td>19mm furniture-grade plywood, edge-banded on all exposed faces. No particleboard in wet-adjacent rooms, ever — it is the first thing to fail and the last thing you can see at a showroom.</td>
          </tr>
          <tr>
            <td><span class="num">Runners</span>Drawers</td>
            <td>Full-extension, soft-close, undermount runners rated to 100 lb. If a runner fails inside ten years we replace it, no questions, job number required.</td>
          </tr>
          <tr>
            <td><span class="num">Hinges</span>Doors</td>
            <td>Soft-close, 110° opening, tool-free adjustment on three axes. Set at install, checked against the drawing before handover.</td>
          </tr>
          <tr>
            <td><span class="num">Lighting</span>Illumination</td>
            <td>2700K LED strips, CRI 90+, wired to a dimmer as standard. Cool-white closet lighting makes every wardrobe look like a filing cabinet; we do not fit it.</td>
          </tr>
          <tr>
            <td><span class="num">Rails</span>Hanging</td>
            <td>Oval steel rail in brushed brass or matte black, wall-to-wall with center support past 36&Prime;. Double-hang wherever your ceiling height allows.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="lum-sec">
    <div class="lum-wrap">
      <div class="lum-sec-head">
        <p class="lum-eyebrow">Finish programs</p>
        <h2>Five finishes, kept in stock and in stock rotation</h2>
        <p>Any of the five takes brushed brass or matte black hardware. Samples ride in the survey van — ask the fitter.</p>
      </div>
      <div class="lum-finishes">
        <div class="lum-finish">
          <div class="chip" style="background:linear-gradient(135deg,#e8dcc8,#d9c9ad 60%,#cbb897)"></div>
          <h4>Rift-sawn white oak</h4>
          <p>Straight grain, clear matte lacquer</p>
        </div>
        <div class="lum-finish">
          <div class="chip" style="background:linear-gradient(135deg,#6d4f38,#5a3f2c 55%,#4a3323)"></div>
          <h4>American walnut</h4>
          <p>Book-matched fronts, oiled</p>
        </div>
        <div class="lum-finish">
          <div class="chip" style="background:linear-gradient(135deg,#f4f1ea,#ece8df)"></div>
          <h4>Matte lacquer</h4>
          <p>Any RAL color, 30% sheen</p>
        </div>
        <div class="lum-finish">
          <div class="chip" style="background:linear-gradient(160deg,#ffffff,#eef0f2 50%,#e3e7ea)"></div>
          <h4>High-gloss acrylic</h4>
          <p>Seamless edge, wipe-clean</p>
        </div>
        <div class="lum-finish">
          <div class="chip" style="background:linear-gradient(135deg,#c8a165,#b08a4f 55%,#997640)"></div>
          <h4>Brushed brass accents</h4>
          <p>Pulls, rails &amp; trim on any front</p>
        </div>
      </div>
    </div>
  </section>

  <section class="lum-sec tint">
    <div class="lum-wrap">
      <div class="lum-sec-head">
        <p class="lum-eyebrow">Asked at the kitchen table</p>
        <h2>Fair questions, straight answers</h2>
      </div>
      <div class="lum-faq">
        <details>
          <summary>Why does it take six to eight weeks?</summary>
          <p>Roughly one week to survey and draw, a few days for your revisions and signature, three to four weeks in the shop queue for cutting and finishing, and one to two days on site. The queue is the variable — we run one shop and do not subcontract overflow, so busy seasons stretch it.</p>
        </details>
        <details>
          <summary>What does a survey cost if we don&rsquo;t go ahead?</summary>
          <p>Nothing. You keep the drawing either way. About one in five surveys does not become a job, usually because of timing, and that is fine — some of those come back a year later with the sheet still on the fridge.</p>
        </details>
        <details>
          <summary>Can you match what an online configurator quoted me?</summary>
          <p>Sometimes, and we will tell you plainly when we cannot. Configurator systems assume square walls and ship-to-you tolerances. Our price includes the survey, a drawn elevation, shop-cut panels, and our own fitters — where the numbers land close, the difference is who owns the result.</p>
        </details>
        <details>
          <summary>Do you work outside Nashville?</summary>
          <p>We hold a 45-minute radius from the shop — Franklin, Brentwood, Mt. Juliet, and Hendersonville are all inside it. Past that, installs lose a day to travel and the price stops being honest, so we pass and will say so up front.</p>
        </details>
        <details>
          <summary>What happens if something fails in year six?</summary>
          <p>Call the shop with your job number. Runners, hinges, rails, and carcasses are covered for ten years; we pull your drawing from the folder, bring the matching parts, and put it right. Two visits like that in 2024, both under an hour.</p>
        </details>
      </div>
    </div>
  </section>

  <section class="lum-band">
    <div class="lum-wrap">
      <p class="lum-eyebrow">Start with a number</p>
      <h2>Get a realistic range now — the survey and drawing are on us</h2>
      <a class="lum-btn solid" href="/#quote">Price a closet</a>
    </div>
  </section>

  <footer class="lum-foot">
    <div class="lum-foot-in">
      <div>
        <p class="mark">Lumina Custom Closets</p>
        <p style="margin-top:14px; font-size:14.5px; max-width:26em;">A nine-person shop off Charlotte Avenue. We measure, draw, build, and install — and nothing gets cut until you have signed the drawing.</p>
      </div>
      <div>
        <h4>Visit</h4>
        <a href="/">The work</a>
        <a href="/craft">Craft &amp; process</a>
        <a href="/about">About the shop</a>
      </div>
      <div>
        <h4>Enquiries</h4>
        <a href="/#quote">Price a closet</a>
        <a href="tel:+16155550164">(615) 555-0164</a>
        <a href="mailto:shop@luminaclosets.com">shop@luminaclosets.com</a>
      </div>
      <div>
        <h4>Workshop</h4>
        <a href="#">4218 Charlotte Ave</a>
        <a href="#">Nashville, TN 37209</a>
        <a href="#">Mon–Fri, 7a–4p</a>
      </div>
    </div>
    <div class="fine">
      <span>© 2025 Lumina Custom Closets, LLC · Nashville, Tennessee</span>
      <span>Licensed &amp; insured · TN HIC #78412</span>
    </div>
  </footer>
</div>
$lum_craft$,
          'css', ''
        )
      )
    )
  where tenant_id = lumina_tid;

  -- Match the quote calculator to the site palette.
  update public.contractor_settings
  set widget_theme_id = 'ivory-brass'
  where id = lumina_tid;
end
$demo$;
