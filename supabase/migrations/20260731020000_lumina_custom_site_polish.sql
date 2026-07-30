-- Lumina bespoke site polish: fix "Recent jobs" gallery overlap (negative
-- margin pulled figure 3 over figure 1's caption) and give the dark quote
-- section heading a proper display size.

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
  set custom_config = jsonb_set(custom_config, '{globalCss}', to_jsonb($lum_css$
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
.lum-work figure:nth-child(3) { grid-column: 2 / span 5; margin-top: 56px; }
.lum-work figure:nth-child(4) { grid-column: 7 / span 6; margin-top: 120px; }
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
.lum-quote-sec h2 { color: #f6f2ec; font-size: clamp(28px, 3vw, 42px); margin-top: 22px; }
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
$lum_css$::text))
  where tenant_id = lumina_tid
    and render_mode = 'custom';
end
$demo$;
