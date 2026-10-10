// ─── Big Purchase — Find your car (screen 2 of the new front) ────────────────
// TAB: Goals (sub-screen) | NAV BAR: Hidden — full-bleed
//
// Owner, 2026-09-29. One screen, five views, each saying in its first line
// what is happening on it:
//
//   start  I know what I want · Help me choose, with what peers spend
//   know   type → make and model → new or used, one question at a time
//   quiz   five short questions, then a price range (tier + its $ range)
//   cars   three specific cars, each with a NEW and a USED price to tap
//   car    the five lines, peers beside them, and two ways to spend less
//
// The tester chooses a PRICE, not a car (owner): tapping "Used $30,200" on the
// 4Runner card fills in make, model and new/used in one go.
//
// Continue hands the chosen car to the original four steps, which stay as they
// were (owner: "keep the original screens in at the end").
//
// Model and money: js/bp-finder.js. Nothing here does arithmetic.

// ── Handlers ─────────────────────────────────────────────────────────────────

function bpfOpen() {
  bpfSession();
  go("bpFinder");
}

function bpfView(view) {
  const f = bpfSession();
  f.view = view;
  render();
}

function bpfStartPath(path) {
  const f = bpfSession();
  f.path = path;
  f.view = path;
  bpLog("bp_finder_path", { path: path });
  render();
}

/** Back walks the views the tester came through, then leaves the screen. */
function bpfBack() {
  const f = bpfSession();
  if (f.view === "car")  { f.view = f.path === "quiz" ? "quiz" : "start"; render(); return; }
  if (f.view === "cars") { f.view = "quiz"; render(); return; }
  if (f.view === "quiz") { f.view = "start"; render(); return; }
  navBack();
}

function bpfChoose(modelId, cond) {
  const f = bpfSession();
  bpfSelect(modelId, cond);
  // The car the tester CHOSE from the list or the make-and-model picker. The
  // ways to spend less are measured against it and stay put when one of them
  // is tried (owner, 2026-10-03), so the original is always one tap away.
  f.origin = { id: modelId, cond: cond };
  f.view = "car";
  render();
}

/** Try one of the ways to spend less: the costs change, the list and the original stay. */
function bpfChooseAlt(modelId, cond) {
  const f = bpfSession();
  bpSession().ui.sheet = null;
  bpfSelect(modelId, cond);
  f.view = "car";
  render();
}

/** The cars in the price range peers spend in, for the type of car the tester chose. */
function bpfOpenPeerRange() {
  bpOpenSheet("bpfPeerRange");
}

function renderBpfPeerRangeSheet() {
  const o = bpfOrigin();
  if (!o) return "";
  const tier = bpfPeerTier(o.model.type, o.model.use);
  const green = (bpfQuizResult() || {}).green || null;
  const cars = bpfCarsFor(o.model.type, o.model.use, tier, green);
  const body = `<div class="bpf-cars bpf-peer-cars">${cars.map(m =>
    renderBpfCarBox(m, cars.filter(x => x.price < m.price).length, true)).join("")}</div>`;
  return renderBpSheetFrame(bpVTierLabel(tier) + " range, " + bpfRangeLabel(bpfTierRange(o.model.type, o.model.use, tier)), body);
}

/** The car the tester first chose (falls back to what is on screen). */
function bpfOrigin() {
  const f = bpfSession();
  const o = f.origin || f.sel;
  const model = o ? bpfModel(o.id) : null;
  return model ? { model: model, cond: o.cond } : null;
}

function bpfContinue() {
  const sel = bpfSelected();
  if (!sel) return;
  bpLog("bp_finder_done", { model: sel.model.id, cond: sel.cond });
  bpSession().ui.q = null;
  go("bpYourCar");
}

// "I know what I want" — MAKE, then MODEL, then new or used, the way the big
// car sites do it (owner, 2026-10-01: "drop-downs by make, then model… replicate
// that for familiarity"). Kelley Blue Book, Edmunds and Cars.com all lead with
// a make list A–Z and a model list that unlocks once a make is chosen, then one
// button. Their Year select is New / Used here, because that is what this tool
// prices. There is no type question: the make and model already say it.
function bpfKnowPick(field, value) {
  const k = bpfSession().know;
  if (field === "make") {
    if (k.make !== value) k.model = null;
    k.make = value || null;
  } else if (field === "model") {
    k.model = value || null;
  } else if (field === "cond") {
    k.cond = value;
  }
  render();
}

/** The Make or Model list, rising from the bottom of the frame. */
function bpfOpenList(which) {
  if (which === "model" && !bpfSession().know.make) return;
  bpOpenSheet(which === "model" ? "bpfModel" : "bpfMake");
}

function bpfListPick(which, value) {
  bpSession().ui.sheet = null;
  bpfKnowPick(which, value);
  // Choosing a make opens the Model question straight away (owner, 2026-10-03).
  if (which === "make" && value) bpfOpenList("model");
}

function renderBpfListSheet(which) {
  const k = bpfSession().know;
  const items = which === "model"
    ? bpfModelsOfMake(k.make).map(x => ({ v: x.id, label: x.model, on: k.model === x.id }))
    : bpfMakes().map(mk => ({ v: mk, label: mk, on: k.make === mk, logo: renderBpfLogo(mk) }));
  const body = `
    <div class="bp-sheet-list bpf-list" role="listbox">
      ${items.map(i => `
        <button class="bp-opt ${i.on ? "on" : ""}" type="button" role="option" aria-selected="${i.on}"
                onclick="bpfListPick('${which}','${h(i.v)}')">${i.logo || ""}<span>${h(i.label)}</span></button>`).join("")}
    </div>`;
  return renderBpSheetFrame(which === "model" ? k.make + " models" : "Choose a make", body);
}

/** The button. Looks off until all three are set; checked here, never `disabled`. */
function bpfKnowGo() {
  const k = bpfSession().know;
  if (!k.model || !k.cond) { render(); return; }
  bpfSession().path = "know";
  bpfChoose(k.model, k.cond);
}

function bpfMakes() {
  return Array.from(new Set(bpfModels().map(m => m.make))).sort((a, b) => a.localeCompare(b));
}

function bpfModelsOfMake(make) {
  return bpfModels().filter(m => m.make === make).sort((a, b) => a.model.localeCompare(b.model));
}

// "Help me choose" — the quiz, then the price range.
function bpfQuizAnswer(qid, optId) {
  const f = bpfSession();
  f.quiz.answers[qid] = optId;
  f.quiz.editing = null;
  f.quiz.open = false;          // fold the answers again once the change lands
  f.bucket = null;              // a changed answer can change the bucket
  bpLog("bp_finder_quiz", { question: qid, option: optId });
  render();
}

function bpfQuizEdit(qid) {
  const q = bpfSession().quiz;
  q.editing = q.editing === qid ? null : qid;
  render();
}

/** Unfold the answers row back into five tappable rows. */
function bpfQuizOpen() {
  const q = bpfSession().quiz;
  q.open = !q.open;
  render();
}

function bpfQuizReset() {
  const f = bpfSession();
  f.quiz = { answers: {}, editing: null };
  f.rangeOpen = false;
  f.bucket = null;
  f.tier = null;
  bpLog("bp_finder_quiz_reset", {});
  render();
}

function bpfSetBucket(type, use) {
  const f = bpfSession();
  f.bucket = { type: type, use: use };
  f.tier = null;
  f.rangeOpen = false;
  render();
}

// The three cars now sit on the quiz screen itself, under the price range
// (owner, 2026-10-03: "all choices are self-contained on the same screen"), so
// choosing a range stays on this view and the range row reopens the picker.
function bpfSetTier(tier) {
  const f = bpfSession();
  f.tier = tier;
  f.quiz.open = false;
  f.rangeOpen = false;
  f.quiz.editing = null;
  f.view = "quiz";
  bpLog("bp_finder_tier", { tier: tier, bucket: bpfBucket() });
  render();
}

function bpfRangeOpen() {
  const f = bpfSession();
  f.rangeOpen = true;
  render();
}

/** The X under any open picker: close it without choosing anything new. */
function bpfDockClose() {
  const f = bpfSession();
  f.rangeOpen = false;
  f.quiz.editing = null;
  f.quiz.open = false;
  render();
}

/** The bucket on screen: a runner-up the tester tapped, else the quiz's winner. */
function bpfBucket() {
  const f = bpfSession();
  return f.bucket || bpfQuizResult().best;
}

function bpfQuizDone() {
  const a = bpfSession().quiz.answers;
  return bpfQuizQuestions().every(q => !!a[q.id]);
}

// ── Render: pieces ───────────────────────────────────────────────────────────

function renderBpfHead(title) {
  return `
    <p class="helper bpf-eyebrow">Find your car</p>
    <h1 class="title esf-title">${h(title)}</h1>`;
}

function renderBpfFoot(cont) {
  return `
    <div class="journal-foot esf-foot">
      <button class="button secondary" type="button" onclick="bpfBack()">Back</button>
      ${renderBpBuddyButton()}
      ${cont ? `<button class="button" type="button" onclick="bpfContinue()">Continue</button>` : "<span></span>"}
    </div>`;
}

/** What peers spend, as plain facts. Used on the first view. */
function renderBpfPeerFact() {
  const p = bpfPeer();
  if (!p.payment) return "";
  return `
    <div class="bpf-peerfact">
      <p class="bpf-peerfact-who">${h(bpfPeerWho())} spend about</p>
      <div class="bpf-peerfact-row"><span>Car payment</span><strong>${h(bpMoney(p.payment))} <i>a month</i></strong></div>
      <div class="bpf-peerfact-row"><span>With insurance, fuel and upkeep</span><strong>${h(bpMoney(p.total))} <i>a month</i></strong></div>
    </div>`;
}

function renderBpfDock(ask, tiles, closable) {
  return `
    <div class="bp-dock bpf-dock">
      <p class="bp-ask">${h(ask)}</p>
      ${tiles}
      ${closable ? `
        <button class="bpf-close" type="button" onclick="bpfDockClose()" aria-label="Close without changing">
          <span aria-hidden="true">&times;</span> Close
        </button>` : ""}
    </div>`;
}

/** A hue for a make, so every maker keeps one colour wherever it shows. */
function bpfMakeHue(make) {
  const i = bpfMakes().indexOf(make);
  return Math.round(((i < 0 ? 0 : i) * 137.5 + 24) % 360);
}

/**
 * A car box's colour says where it sits among the three, by price: the cheapest
 * is green (owner, 2026-10-03), the next blue, the dearest violet. Calm hues on
 * purpose: no red or amber, because a price is never flagged as high.
 */
const BPF_RANK_HUES = [145, 215, 270];

/** Each make's real logo in assets/img/logos: Simple Icons SVGs, plus six PNGs from the open car-logos-dataset. */
const BPF_LOGO_FILES = {
  audi: "audi.svg", bmw: "bmw.svg", chevrolet: "chevrolet.svg", ford: "ford.svg", honda: "honda.svg",
  hyundai: "hyundai.svg", jeep: "jeep.svg", kia: "kia.svg", mazda: "mazda.svg", mitsubishi: "mitsubishi.svg",
  nissan: "nissan.svg", ram: "ram.svg", subaru: "subaru.svg", tesla: "tesla.svg", toyota: "toyota.svg",
  volkswagen: "volkswagen.svg", volvo: "volvo.svg",
  genesis: "genesis.png", gmc: "gmc.png", landrover: "land-rover.png", lexus: "lexus.png",
  mercedesbenz: "mercedes-benz.png", rivian: "rivian.png"
};

/** The make's logo on a white chip. A make with no logo file gets its first letters on its colour. */
function renderBpfLogo(make) {
  const slug = String(make || "").toLowerCase().replace(/[^a-z]/g, "");
  if (BPF_LOGO_FILES[slug]) {
    return `<span class="bpf-logo bpf-logo-chip" aria-hidden="true"><img class="bpf-logo-img" src="assets/img/logos/${BPF_LOGO_FILES[slug]}" alt=""></span>`;
  }
  const t = String(make || "").replace(/[^A-Za-z]/g, "").slice(0, 2);
  return `<span class="bpf-logo" aria-hidden="true">${h(t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())}</span>`;
}

/**
 * One question as a dropdown row. THE PATTERN FOR ANY SCREEN THAT ASKS SEVERAL
 * QUESTIONS (owner, 2026-10-03: "the first question appears at the bottom then
 * when it's answered, it moves to the top… this pattern needs to be used
 * everywhere"): every question has its row from the start, in place. An answered
 * row shows its answer; the question being asked is an open row ("Select one",
 * outlined) with its choices docked below; the rest are locked until their turn.
 * An answer then FILLS its row, and nothing jumps.
 */
function renderBpfAnsRow(label, val, onclick, on, locked) {
  if (locked) {
    return `
    <button class="bp-ans bp-ans-locked" type="button" disabled
            aria-label="${h(label)}: answer the question above first">
      <span class="bp-ans-label">${h(label)}</span>
      <span class="bp-ans-val"></span>
      <span class="bp-drop-caret" aria-hidden="true">&#9662;</span>
    </button>`;
  }
  return `
    <button class="bp-ans ${on ? "on" : ""} ${val ? "" : "bp-ans-empty"}" type="button" onclick="${onclick}"
            aria-label="${h(label)}: ${val ? h(val) + ". Change" : "choose below"}">
      <span class="bp-ans-label">${h(label)}</span>
      <span class="bp-ans-val">${h(val || "Select one")}</span>
      <span class="bp-drop-caret" aria-hidden="true">&#9662;</span>
    </button>`;
}

// ── Views ────────────────────────────────────────────────────────────────────

function renderBpfStart() {
  const f = bpfSession();
  const k = f.know;
  const m = k.model ? bpfModel(k.model) : null;
  const ready = !!(m && k.cond);
  const field = (label, value, placeholder, list, enabled, icon) => `
    <div class="bpf-know-field">
      <span>${h(label)}</span>
      <button class="bpf-select ${value ? "" : "bpf-select-empty"}" type="button" ${enabled ? "" : "disabled"}
              aria-haspopup="listbox" onclick="bpfOpenList('${list}')">
        <span class="bpf-select-val">${value ? (icon || "") : ""}<span>${h(value || placeholder)}</span></span>
        <span class="bp-drop-caret" aria-hidden="true">&#9662;</span>
      </button>
    </div>`;
  const cond = (id, label, price) => `
    <button class="bpf-cond ${k.cond === id ? "on" : ""}" type="button" aria-pressed="${k.cond === id}"
            onclick="bpfKnowPick('cond','${id}')">
      <span class="bpf-cond-label">${h(label)}</span>
      <span class="bpf-cond-price">${h(bpMoney(price))}</span>
    </button>`;
  return `
    <div class="journal-shell onb-pinned bpf-shell bpf-start-shell">
      <div class="journal-head">
        ${/* The owner's banner lives here (2026-10-01), with the title it
              illustrates. */ ""}
        <div class="bp-land-banner bpf-banner">
          <img src="assets/img/buddy-car.jpg" alt="" aria-hidden="true">
        </div>
        ${renderBpfHead("Find the right car for you")}
      </div>
      <div class="journal-body">
        ${/* Screens 2 and 3 are one screen (owner, 2026-10-03: "I know what I
              want converted to a headline with make and model under it to
              combine screen 2 and 3"). The headline is the "know" path; make,
              model, new or used and the button sit in the thumb dock under it.
              "Help me choose" is the other path, a row beneath the button.
              No peer figures here (owner, 2026-10-01). */ ""}
        ${m ? `
          <div class="bpf-know-pick">
            <p class="bpf-know-name">${h(bpfName(m))}</p>
            <p class="bpf-know-why">${h(bpfTypeLabel(m.type))} · ${h(bpfKnown(m))}</p>
          </div>` : `
          <p class="bp-lead">Start with a car you have in mind, or answer five quick questions and
             we'll show you choices that fit how you live.</p>`}
      </div>
      <div class="bp-dock bpf-dock bpf-help">
        <button class="bpf-path bpf-path-quiz" type="button" onclick="bpfStartPath('quiz')">
          <span class="bpf-path-emoji" aria-hidden="true"><img class="bpf-path-face" src="${h(ESF_BUDDY_PILL_ART)}" alt="" onerror="${ESF_BUDDY_ART_FALLBACK}"></span>
          <span class="bpf-path-title">Help me choose a car</span>
          <span class="bpf-path-go" aria-hidden="true">&rsaquo;</span>
        </button>
      </div>
      <div class="bp-dock bpf-dock bpf-know bpf-know-sec">
        <p class="bpf-know-head">I know what I want</p>
        ${field("Make", k.make, "Select a make", "make", true, k.make ? renderBpfLogo(k.make) : "")}
        ${field("Model", m ? m.model : null, k.make ? "Select a model" : "Select a make first", "model", !!k.make)}
        ${m ? `
          <div class="bpf-conds">
            ${cond("new", "New", m.price)}
            ${cond("used", "Used, ~3 yrs", bpfUsedPrice(m))}
          </div>` : ""}
        <button class="button full ${ready ? "" : "bp-off"}" type="button" aria-disabled="${!ready}"
                onclick="bpfKnowGo()">${ready ? "See the real cost to own"
                                     : m ? "Pick new or used" : "Pick a make and model"}</button>
      </div>
      ${renderBpfFoot(false)}
    </div>`;
}

/** The make-and-model list, grouped by price tier with each tier's range. */
function renderBpfModelList(type, current) {
  return `
    <div class="bpf-modellist">
      ${bpfTiers().map(t => {
        const ms = bpfModels().filter(m => m.type === type && m.tier === t)
                              .sort((a, b) => a.price - b.price);
        if (!ms.length) return "";
        const r = { lo: ms[0].price, hi: ms[ms.length - 1].price };
        return `
          <p class="bpf-tierhead">${h(bpVTierLabel(t))} <span>${h(bpfRangeLabel(r))}</span></p>
          ${ms.map(m => `
            <button class="bpf-modelopt ${current === m.id ? "on" : ""}" type="button"
                    onclick="bpfKnowPick('model','${h(m.id)}')">
              <span>${h(bpfName(m))}</span>
              <span class="bpf-modelopt-price">${h(bpMoney(m.price))}</span>
            </button>`).join("")}`;
      }).join("")}
    </div>`;
}

function renderBpfKnow() {
  const f = bpfSession();
  const k = f.know;
  const m = k.model ? bpfModel(k.model) : null;
  const ready = !!(m && k.cond);
  // NOT NATIVE <select>s any more (owner, 2026-10-01: "the make drop-down
  // choice wasn't one handed friendly. it dropped up"). A native list at the
  // bottom of the screen opens UPWARD, away from the thumb. Each field now
  // looks like a car-site dropdown but opens a list that rises from the
  // bottom of the frame (bpfOpenList), which is how the car sites' own phone
  // apps do it.
  const field = (label, value, placeholder, list, enabled) => `
    <div class="bpf-know-field">
      <span>${h(label)}</span>
      <button class="bpf-select ${value ? "" : "bpf-select-empty"}" type="button" ${enabled ? "" : "disabled"}
              aria-haspopup="listbox" onclick="bpfOpenList('${list}')">
        <span>${h(value || placeholder)}</span>
        <span class="bp-drop-caret" aria-hidden="true">&#9662;</span>
      </button>
    </div>`;
  // The prices are as big and bold as the car's name (owner): they are the
  // reason for the choice, not a footnote to it.
  const cond = (id, label, price) => `
    <button class="bpf-cond ${k.cond === id ? "on" : ""}" type="button" aria-pressed="${k.cond === id}"
            onclick="bpfKnowPick('cond','${id}')">
      <span class="bpf-cond-label">${h(label)}</span>
      <span class="bpf-cond-price">${h(bpMoney(price))}</span>
    </button>`;
  return `
    <div class="journal-shell onb-pinned bpf-shell">
      <div class="journal-head">${renderBpfHead("Which car do you have in mind?")}</div>
      <div class="journal-body">
        <p class="bp-lead">Choose the make and model. We'll price it new and used, and show what it
           costs to own.</p>
        ${m ? `
          <div class="bpf-know-pick">
            <p class="bpf-know-name">${h(bpfName(m))}</p>
            <p class="bpf-know-why">${h(bpfTypeLabel(m.type))} · ${h(bpfKnown(m))}</p>
          </div>` : ""}
      </div>
      <div class="bp-dock bpf-dock bpf-know">
        ${field("Make", k.make, "Select a make", "make", true)}
        ${field("Model", m ? m.model : null, k.make ? "Select a model" : "Select a make first", "model", !!k.make)}
        ${m ? `
          <div class="bpf-conds">
            ${cond("new", "New", m.price)}
            ${cond("used", "Used, about 3 years", bpfUsedPrice(m))}
          </div>` : ""}
        ${/* The CTA names the next screen (owner: "see what it costs" with the
              price right above it read as already done). The next screen is
              the monthly, year-one and five-year cost to OWN, beside peers. */ ""}
        <button class="button full ${ready ? "" : "bp-off"}" type="button" aria-disabled="${!ready}"
                onclick="bpfKnowGo()">${ready ? "See the real cost to own"
                                     : m ? "Pick new or used" : "Pick a make and model"}</button>
      </div>
      ${renderBpfFoot(false)}
    </div>`;
}

function renderBpfQuiz() {
  const f = bpfSession();
  const q = f.quiz;
  const qs = bpfQuizQuestions();
  const current = q.editing && q.editing !== "range"
    ? qs.find(x => x.id === q.editing)
    : qs.find(x => !q.answers[x.id]);
  const done = bpfQuizDone();
  const r = done ? bpfQuizResult() : null;
  const bucket = done ? bpfBucket() : null;
  const use = bucket ? bpfUse(bucket.type, bucket.use) : null;

  // Everything the tester chose lives on this one screen (owner, 2026-10-03:
  // "all choices are self-contained on the same screen. user can easily edit
  // and modify to see the choices at the bottom"): the answers, the fit, the
  // price range and the three cars. A picker (a question, the answers, the
  // range) opens in the dock and always has an X to close it unchanged.
  const pickingRange = !!(done && !current && (!f.tier || f.rangeOpen));
  const showCars = !!(done && f.tier && !current && !q.open && !f.rangeOpen);

  let dock = "";
  if (current) {
    const opts = (current.options || []).map(o => ({ id: o.id, label: o.label, sub: o.sub || "", emoji: o.emoji || "" }));
    dock = renderBpfDock((current.emoji ? current.emoji + " " : "") + current.ask,
      bpTiles(opts, q.answers[current.id], id => `bpfQuizAnswer('${current.id}','${id}')`,
              bpDockLayout(opts, true)), !!q.answers[current.id]);
  } else if (q.open && !pickingRange) {
    dock = renderBpfDock("Tap an answer to change it", "", true);
  } else if (pickingRange) {
    // The tier and its price range as one label (owner: "a duo display of the
    // tier and price range"), the three cars in it underneath, and a plain tag
    // on the range peers' payment falls in. A fact, not a nudge: every range
    // is one tap away and none is drawn as chosen.
    const peerTier = bpfPeerTier(bucket.type, bucket.use);
    dock = renderBpfDock("Price range for " + (use ? use.label : "your pick"), `
      <div class="bpf-ranges">
        ${bpfTiers().map(t => `
          <button class="bpf-range ${f.tier === t ? "on" : ""}" type="button" onclick="bpfSetTier('${t}')">
            <span class="bpf-range-top">
              <span class="bpf-range-tier">${h(bpVTierLabel(t))}</span>
              <span class="bpf-range-price">${h(bpfRangeLabel(bpfTierRange(bucket.type, bucket.use, t)))}</span>
              ${t === peerTier ? `<span class="bpf-range-peer">Peers spend about here</span>` : ""}
            </span>
            <span class="bpf-range-cars">${h(bpfModelsIn(bucket.type, bucket.use, t).map(bpfName).join(", "))}</span>
          </button>`).join("")}
      </div>`, !!f.tier);
  }

  const answered = qs.filter(x => q.answers[x.id]);
  // Once all five are in, the answers fold into ONE row so the result has the
  // room: five rows plus the result plus the cars is more than a phone.
  const folded = done && !current && !q.open && !pickingRange;
  const tier = f.tier;
  const green = done ? r.green : null;
  const cars = showCars ? bpfCarsFor(bucket.type, bucket.use, tier, green) : [];
  return `
    <div class="journal-shell onb-pinned bpf-shell bpf-quiz-shell">
      <div class="journal-head">
        ${showCars ? `<div class="bp-land-banner bpf-banner bpf-banner-quiz"><img src="assets/img/buddy-car.jpg" alt="" aria-hidden="true"></div>` : ""}
        ${renderBpfHead("Help me choose")}
      </div>
      <div class="journal-body">
        ${answered.length ? "" : `<p class="bp-lead">Five quick questions about how you'll use it. No wrong answers.</p>`}
        ${folded ? `
          <div class="bp-answers bpf-answers">
            ${renderBpfAnsRow("Your answers", answered.map(x => { const o = bpfQuizOption(x, q.answers[x.id]) || {}; return (o.emoji || "") + (o.label ? " " + o.label : ""); })
                                .concat(tier ? [bpVTierLabel(tier)] : []).join(" · "),
                              "bpfQuizOpen()", false)}
          </div>` : `
          ${/* The price range is the sixth question (owner, 2026-10-03: "price
                needs to be part of the questions so there is only one set of
                drop-downs"). It is locked until the five are answered, then it
                is the open row like any other. */ ""}
          <div class="bp-answers bpf-answers">
            ${qs.map(x => {
              const o = bpfQuizOption(x, q.answers[x.id]);
              const isCurrent = !!(current && current.id === x.id);
              return renderBpfAnsRow((x.emoji ? x.emoji + " " : "") + (x.short || x.ask), o ? (o.emoji ? o.emoji + " " : "") + o.label : "", `bpfQuizEdit('${x.id}')`,
                                     isCurrent, !o && !isCurrent);
            }).join("")}
            ${renderBpfAnsRow("💰 Price", tier && bucket ? bpVTierLabel(tier) + " · " +
                                bpfRangeLabel(bpfTierRange(bucket.type, bucket.use, tier)) : "",
                              "bpfRangeOpen()", pickingRange, !done)}
          </div>
          ${!answered.length || (done && current) || pickingRange ? "" : `<button class="bp-link bpf-reset" type="button" onclick="bpfQuizReset()">Start the questions over</button>`}`}
        ${bucket && use && !current && !pickingRange ? `
          <div class="bpf-fit">
            <p class="bpf-fit-type"><span class="bpf-fit-said">Sounds like</span> ${h(use.label)}</p>
            ${tier ? `<p class="bpf-fit-tier">${h(bpVTierLabel(tier))} · ${h(bpfRangeLabel(bpfTierRange(bucket.type, bucket.use, tier)))}</p>` : ""}
            <p class="bpf-fit-why">${h(use.blurb)}</p>
            ${r.also.length ? `
              <p class="bpf-fit-also">Also fits:
                ${r.also.concat([r.best]).filter(b => !(b.type === bucket.type && b.use === bucket.use)).slice(0, 2)
                  .map(b => `<button class="bp-link" type="button" onclick="bpfSetBucket('${b.type}','${b.use}')">${
                    h((bpfUse(b.type, b.use) || {}).label || "")}</button>`).join(" · ")}</p>` : ""}
          </div>` : ""}
        ${showCars ? `
          <div class="bpf-cars">${cars.map(m => renderBpfCarBox(m, cars.filter(x => x.price < m.price).length)).join("")}</div>` : ""}
      </div>
      ${dock}
      ${renderBpfFoot(false)}
    </div>`;
}

/** One car in the list: its make's badge and colour, what it is known for, two prices. */
function renderBpfCarBox(m, rank, alt) {
  const chip = cond => {
    const card = bpfCard(m, cond);
    const fig = bpfFigures(card);
    const f = bpfSession();
    const on = f.sel && f.sel.id === m.id && f.sel.cond === cond;
    return `
      <button class="bpf-price ${on ? "on" : ""}" type="button" onclick="${alt ? "bpfChooseAlt" : "bpfChoose"}('${h(m.id)}','${cond}')">
        <span class="bpf-price-line">
          <span class="bpf-price-cond">${cond === "used" ? "Used" : "New"}</span>
          <span class="bpf-price-big">${h(bpMoney(card.inputs.price))}</span>
        </span>
        <span class="bpf-price-five">${h(bpMoney(fig.five))} over 5 yrs</span>
      </button>`;
  };
  return `
    <div class="bpf-car" style="--h:${BPF_RANK_HUES[rank] || 215}">
      <div class="bpf-car-top">
        ${renderBpfLogo(m.make)}
        <p class="bpf-car-name">${h(bpfName(m))}</p>
      </div>
      <p class="bpf-car-why">${h(bpfKnown(m))}</p>
      <div class="bpf-car-prices">${chip("new")}${chip("used")}</div>
    </div>`;
}

/**
 * Why this car, in facts the tester gave us. Never "best for you" (owner,
 * 2026-09-28: "it's always here are choices based on info the user
 * submitted").
 */
function bpfWhyLine(m) {
  const f = bpfSession();
  if (f.path !== "quiz") return bpfKnown(m) + ".";
  const use = bpfUse(m.type, m.use);
  return bpfKnown(m) + ". " + (use ? use.blurb + ", " : "") + "in the " +
         bpVTierLabel(m.tier).toLowerCase() + " range you picked.";
}

function renderBpfLines(fig, loan) {
  const rows = [
    { label: "Sticker price", value: fig.sticker },
    loan ? { label: "Down payment", note: "(" + Math.round(fig.down / Math.max(1, fig.sticker) * 100) + "%)", value: fig.down }
         : { label: "Paid at purchase", note: "(with tax and fees)", value: fig.b.yearOne.atPurchase },
    { label: "Total monthly cost", note: loan ? "(car payment + running it)" : "(running it)", value: fig.monthly, hero: true },
    { label: "Year 1 cost", note: "(all-in)", value: fig.year1 },
    { label: "Cost over 5 years", note: "(all-in)", value: fig.five }
  ];
  return `
    <div class="bpf-lines">
      ${rows.map(r => `
        <div class="bpf-line ${r.hero ? "bpf-line-hero" : ""}">
          <span class="bpf-line-label">${h(r.label)}${r.note ? ` <em>${h(r.note)}</em>` : ""}</span>
          <span class="bpf-line-fig">${h(bpMoney(r.value))}</span>
        </div>`).join("")}
    </div>`;
}

function renderBpfPeerBox(fig, loan) {
  const p = bpfPeer();
  const my = { pay: loan ? fig.payment : 0, total: fig.monthly };
  const pctMe = bpfPct(my.total), pctPeer = bpfPct(p.total);
  const gap = my.total - p.total;
  return `
    <div class="bpf-peer">
      <p class="bpf-box-head">Compared with peers</p>
      <p class="bpf-box-note">${h(bpfPeerWho())}</p>
      <div class="bpf-grid">
        <span></span><span class="bpf-grid-h">This car</span><span class="bpf-grid-h">Peers</span>
        <span>Car payment</span><strong>${h(bpMoney(my.pay))}</strong><strong>${h(bpMoney(p.payment))}</strong>
        <span>Total monthly</span><strong>${h(bpMoney(my.total))}</strong><strong>${h(bpMoney(p.total))}</strong>
        ${pctMe != null ? `
          <span>Share of your income</span><strong>${pctMe}%</strong><strong>${pctPeer}%</strong>` : ""}
      </div>
      <p class="bpf-gap">${gap === 0
        ? "The same total monthly as peers."
        : h(bpMoney(Math.abs(gap))) + " a month " + (gap > 0 ? "more" : "less") + " than peers, all-in."}</p>
    </div>`;
}

function bpfGrowth(perMonth, upfront) {
  const i = Number(bpSession().savingsRate) || 0.07;
  const r = i / 12;
  const annuity = r > 0 ? (Math.pow(1 + r, 60) - 1) / r : 60;
  return (upfront || 0) * Math.pow(1 + i, 5) + perMonth * annuity;
}

/**
 * What an alternative saves: a month, and over five years if the money is kept
 * and grows at the saved rate (7%). Loan and cash cars use the engine's own
 * bpOpportunity (it counts the up-front money too, month by month); a lease, which
 * the engine does not model, and the peers' range use the same idea from the
 * figures on screen.
 */
function bpfSavings(orig, alt, figO, figA) {
  const perMonth = figO.monthly - figA.monthly;
  const leased = bpLeasing(bpfCard(orig.model, orig.cond)) || bpLeasing(bpfCard(alt.model, alt.cond));
  const grown = leased
    ? bpfGrowth(perMonth, figO.down - figA.down)
    : bpOpportunity(bpStack(bpfCard(orig.model, orig.cond), 5), bpStack(bpfCard(alt.model, alt.cond), 5));
  return { month: perMonth, five: grown };
}

/**
 * Alternative cars that can save you money (owner, 2026-10-03): one line saying
 * what the box is for, then for each alternative the saving a month and the
 * saving over 5 years, in two columns. The 5-year figure is not the price
 * difference: it is the money kept and grown at 7% a year, which the footnote
 * says. The tester's own pick stays at the top as a plain row, so it is one tap
 * away. Peers' range is information and is shown whether it saves money or not.
 */
function renderBpfSave() {
  const o = bpfOrigin();
  if (!o) return "";
  const om = o.model, oc = o.cond;
  const f = bpfSession();
  const figO = bpfFigures(bpfCard(om, oc));
  const base = figO.monthly;
  const rows = [];
  if (oc === "new") rows.push({ head: "Same car, used", model: om, cond: "used" });
  const cheap = bpfModelsIn(om.type, om.use, om.tier).filter(x => x.id !== om.id)
    .sort((a, b) => a.price - b.price)[0];
  if (cheap && cheap.price < om.price) rows.push({ head: "Cheapest in class", model: cheap, cond: oc });
  rows.forEach(r => {
    const fa = bpfFigures(bpfCard(r.model, r.cond));
    r.monthly = fa.monthly;
    r.sav = bpfSavings({ model: om, cond: oc }, r, figO, fa);
  });
  const saving = rows.filter(r => r.monthly < base);
  const lowest = saving.length ? Math.min.apply(null, saving.map(r => r.monthly)) : null;
  const peer = bpfPeer();
  const tier = peer.payment ? bpfPeerTier(om.type, om.use) : null;
  const rate = Math.round((Number(bpSession().savingsRate) || 0.07) * 100);
  const same = r => !r.peers && f.sel && f.sel.id === r.model.id && f.sel.cond === r.cond;
  const money = (n, good) => {
    const v = Math.round(n);
    return `<span class="${good ? "bpf-alt-good" : ""}">${v >= 0 ? h(bpMoney(v)) : h(bpMoney(-v)) + " more"}</span>`;
  };
  const row = (r, inner, on, click, hue) => `
    <button class="bpf-alt ${on ? "bpf-alt-on" : ""} ${r.orig ? "bpf-alt-orig" : ""}" type="button" style="--h:${hue}"
            aria-pressed="${!!on}" onclick="${click}">${inner}</button>`;
  const cols = (c1, c2) => `<span class="bpf-alt-c1">${c1}</span><span class="bpf-alt-c2">${c2}</span>`;
  const one = r => {
    const best = r.monthly === lowest;
    return row({}, `
      ${renderBpfLogo(r.model.make)}
      <span class="bpf-alt-text">
        <span class="bpf-alt-name">${h(r.model.model)}</span>
        <span class="bpf-alt-head">${h(r.head)}</span>
      </span>
      ${cols(money(r.sav.month, best), money(r.sav.five, best))}`,
      same(r), `bpfChooseAlt('${h(r.model.id)}','${r.cond}')`, best ? 145 : 215);
  };
  const origRow = row({ orig: true }, `
      ${renderBpfLogo(om.make)}
      <span class="bpf-alt-text">
        <span class="bpf-alt-name">${h(om.model)}</span>
        <span class="bpf-alt-head">Your pick${oc === "used" ? ", used" : ""}</span>
      </span>
      ${cols(money(0, false), money(0, false))}`,
      same({ model: om, cond: oc }), `bpfChooseAlt('${h(om.id)}','${oc}')`, 215);
  const peerRow = tier ? row({ peers: true }, `
      <span class="bpf-logo bpf-logo-peers" aria-hidden="true">${BPF_PEOPLE_ICON}</span>
      <span class="bpf-alt-text">
        <span class="bpf-alt-name">${h(bpVTierLabel(tier))} range</span>
        <span class="bpf-alt-head">What peers spend</span>
      </span>
      ${cols(money(base - peer.total, false), money(bpfGrowth(base - peer.total, 0), false))}`,
      false, "bpfOpenPeerRange()", 215) : "";
  if (!saving.length && !peerRow) return "";
  return `
    <div class="bpf-save">
      <p class="bpf-save-head">Alternative cars that can save you money</p>
      <div class="bpf-save-cols"><span></span><span class="bpf-save-saved">Saved</span><span>per month</span><span>over 5 years*</span></div>
      ${origRow}
      ${saving.map(one).join("")}
      ${peerRow}
      <p class="bpf-save-note">* If the money you save is invested at ${h(String(rate))}% a year.</p>
    </div>`;
}

const BPF_PEOPLE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 19c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5zM15.8 14c3 .2 5.7 1.9 5.7 5h-4.4c0-2-.5-3.6-1.3-5z"/></svg>`;

/**
 * What peers' year-one and five-year costs come to: the car their payment buys,
 * on this car's loan settings, with their running cost swapped in for the
 * engine's so the rows above and below agree with each other.
 */
function bpfPeerFigures(m) {
  const p = bpfPeer();
  const price = bpfPeerPrice(m.type);
  if (!price) return null;
  const pf = bpfFigures({ id: "f:peerfig", label: "Peers", inputs:
    { type: m.type, tier: "everyday", fuel: "gas", condition: "new", price: price } }, { noLease: true });
  const adj = p.running - pf.running;
  return { year1: pf.year1 + adj * 12, five: pf.five + adj * 60 };
}

/**
 * The one expense table (owner, 2026-10-03): this car in the first column,
 * bold; peers in the second, plain and smaller, behind a rule. Car payment, cost
 * of running it, the total monthly, the payment as a share of monthly income,
 * then year one and five years, so every figure sits beside its peer figure.
 * The footnote, inside the card, says who peers are and the miles assumed.
 * Peers are information only: no verdict, no threshold, anywhere.
 */
function renderBpfTable(m, fig, loan) {
  const p = bpfPeer();
  const pf = loan ? bpfPeerFigures(m) : null;
  const pctMe = loan ? bpfPct(fig.payment) : null, pctPeer = bpfPct(p.payment);
  const row = (label, me, peer, cls, extra) => `
    <div class="bpf-t-label ${cls || ""}">
      <span class="bpf-t-name">${h(label)}</span>
      ${extra || ""}
    </div>
    <strong class="bpf-t-me ${cls || ""}">${me}</strong>
    <span class="bpf-t-peer ${cls || ""}">${peer}</span>`;
  const link = `<button class="bpf-t-link" type="button" onclick="bpfOpenCalc()">See how we calculated this</button>`;
  return `
    <div class="bpf-table">
      <span></span><span class="bpf-t-h">This car</span><span class="bpf-t-h bpf-t-h-peer">Peers*</span>
      ${loan ? row(fig.lease ? "Lease payment" : "Car payment", h(bpMoney(fig.payment)), h(bpMoney(p.payment)), "") : ""}
      ${row("Cost of running it", h(bpMoney(fig.running)), h(bpMoney(p.running)), "")}
      ${row("Total monthly payment", h(bpMoney(fig.monthly)), h(bpMoney(p.total)), "bpf-t-total")}
      ${pctMe != null && pctPeer != null ? row("Payment as % of income", pctMe + "%", pctPeer + "%") : ""}
      ${row("Year 1 cost", h(bpMoney(fig.year1)), pf ? h(bpMoney(pf.year1)) : "", "bpf-t-long")}
      ${row("Cost over 5 years", h(bpMoney(fig.five)), pf ? h(bpMoney(pf.five)) : "", "bpf-t-long")}
      <div class="bpf-t-calc">${link}</div>
      <p class="bpf-t-foot">* Based on peers in ${h(bpVCity())}, estimated ${h(String(bpVMilesPerDay()))} miles a day.</p>
    </div>`;
}

function renderBpfCar() {
  const sel = bpfSelected();
  if (!sel) { bpfSession().view = "start"; return renderBpfStart(); }
  const m = sel.model, cond = sel.cond;
  const s = bpSession();
const fig = bpfFigures(bpCard("pick"));  const leasing = !!fig.lease;  const loan = leasing || s.pay.mode === "loan";
  return `
    <div class="journal-shell onb-pinned bpf-shell bpf-car-shell">
      <div class="journal-head">
        <p class="helper bpf-eyebrow">What it costs to own</p>
        <h1 class="title esf-title bpf-car-title" style="--h:145">${renderBpfLogo(m.make)}<span>${h(bpfName(m))} (${cond === "used" ? "Used" : "New"})</span></h1>
      </div>
      <div class="journal-body">
        <p class="bpf-why">${h(bpfKnown(m))}</p>
        <div class="bpf-deal-row">
          <div class="bpf-deal-cell"><strong>${h(bpMoney(fig.sticker))}</strong><span>Sticker price</span></div>
          ${loan ? `<div class="bpf-deal-cell"><strong>${h(bpMoney(fig.down))}</strong><span>${leasing ? "Due at signing" : "Money down"}</span></div>` : ""}
        </div>
        ${renderBpfTable(m, fig, loan)}
        ${renderBpfSave()}
      </div>
      ${renderBpfFoot(true)}
    </div>`;
}

function renderBpFinder() {
  const f = bpfSession();
  if (f.view === "quiz") return renderBpfQuiz();
  if (f.view === "cars") return renderBpfQuiz();   // retired: the cars sit on the quiz screen
  if (f.view === "car")  return renderBpfCar();
  return renderBpfStart();
}

// ── Buddy: how we worked it out, with every figure editable ──────────────────
// Owner: "there will be an option for users to click to see details of how
// these costs are calculated. when clicked it will open the buddy chat that
// will display these expenses... with options to edit them. If edited, it will
// change the monthly, etc." The edits land on the pick card, so they carry
// into steps 1–4 exactly as if they had been made there.

function bpfOpenCalc() {
  const b = bpBuddy();
  b.forStep = bpBuddyStepKey();
  b.open = true;
  b.calc = true;
  b.calcScroll = 0;
  bpLog("chat_opened", { tool: "bp", step: "finderCalc" });
  render();
}

function bpfCalcSet(rowId, raw) {
  const s = bpSession();
  const n = Math.max(0, Math.round(Number(String(raw == null ? "" : raw).replace(/[^0-9.]/g, "")) || 0));
  if (rowId === "price") {
    if (n > 0) s.setup.price = n;
  } else if (rowId === "taxes") {
    const card = bpCard("pick");
    bpSetRow("pick", "salesTax", Math.max(0, n - bpRowValue(card, "fees")));
  } else {
    bpSetRow("pick", rowId, n);
  }
  bpFieldCommitted();
}

function bpfCalcPay(field, value) {
  const s = bpSession();
  if (field === "mode") {
    // Loan, Cash or Lease (owner, 2026-10-03). Lease is the flag the last screen reads too.
    s.pay.leasing = value === "lease";
    if (value !== "lease") s.pay.mode = value;
    bpLog("bp_finder_calc_pay", { field: field, value: value });
    render();
    return;
  }
  s.pay[field] = value;
  if (field === "down") s.pay.downAmount = null;
  bpLog("bp_finder_calc_pay", { field: field, value: value });
  render();
}

function bpfCalcLease(field, value) {
  bpLeaseSet()[field] = value;
  bpLog("bp_finder_calc_pay", { field: field, value: value });
  render();
}

function bpfCalcReset() {
  const s = bpSession();
  const f = bpfSession();
  s.cardRows = {};
  s.touched = {};
  const m = f.sel ? bpfModel(f.sel.id) : null;
  if (m) s.setup.price = bpfInputs(m, f.sel.cond).price;
  render();
}

function renderBpfCalcPanel() {
  const sel = bpfSelected();
  const s = bpSession();
  if (!sel) return "";
  const card = bpCard("pick");
  const fig = bpfFigures(card);
  const loan = s.pay.mode === "loan";
  const leasing = !!fig.lease;
  const lease = bpLeaseSet();
  const leaseSeg = (field, opts, current) => `
    <div class="bpf-seg" role="group">
      ${opts.map(o => `<button type="button" class="${o.id === current ? "on" : ""}"
          onclick="bpfCalcLease('${field}', ${o.id})">${h(o.label)}</button>`).join("")}
    </div>`;
  const val = id => bpRowValue(card, id);
  const taxes = val("salesTax") + val("fees");
  const fuelLabel = card.inputs.fuel === "electric" ? "Charging" : "Fuel";
  const edited = Object.keys(s.cardRows.pick || {}).length > 0 ||
                 card.inputs.price !== bpfInputs(sel.model, sel.cond).price;
  const input = (id, v, label) => `
    <label class="bpf-calc-row">
      <span>${h(label)}</span>
      <input class="bpf-calc-in" type="text" inputmode="numeric" value="${h(bpMoney(v))}"
             aria-label="${h(label)}, dollars" onchange="bpfCalcSet('${id}', this.value)">
    </label>`;
  const seg = (field, opts, current) => `
    <div class="bpf-seg" role="group">
      ${opts.map(o => `<button type="button" class="${String(o.id) === String(current) ? "on" : ""}"
          onclick="bpfCalcPay('${field}', ${typeof o.id === "number" ? o.id : `'${o.id}'`})">${h(o.label)}</button>`).join("")}
    </div>`;
  const fin = bpData().financing || {};
  const cr = bpData().credit || {};
  const bubble = text => `
    <div class="chat-row esf-buddy-row esf-buddy-row-end">
      <span class="esf-buddy-avatar" aria-hidden="true"><img src="${h(ESF_BUDDY_PILL_ART)}" alt=""
            onerror="${ESF_BUDDY_ART_FALLBACK}"></span>
      <div class="chat-bubble chat-bubble-buddy">${h(text)}</div>
    </div>`;
  return `
    <div class="esf-buddy-scrim" onclick="bpBuddyClose()"></div>
    <div class="esf-buddy" role="dialog" aria-modal="true" aria-label="How we worked it out">
      <div class="esf-buddy-head">
        <p class="esf-buddy-title">How we worked it out</p>
        <img class="esf-buddy-hero" src="${h(ESF_BUDDY_CHAT_ART)}" alt="" aria-hidden="true"
             onerror="${ESF_BUDDY_ART_FALLBACK}">
      </div>
      <div class="esf-buddy-thread" id="bpBuddyThread" onscroll="bpBuddy().calcScroll=this.scrollTop">
        ${bubble("Here's how I got " + bpMoney(fig.monthly) + " a month for the " + bpfName(sel.model) +
                 ". Change any figure and everything updates.")}
        <div class="bpf-calc">
          <p class="bpf-calc-h">When you buy</p>
          ${input("price", card.inputs.price, "Sticker price")}
          ${input("taxes", taxes, "Taxes and fees")}
          <div class="bpf-calc-row"><span>How you'll pay</span>
            ${seg("mode", [{ id: "loan", label: "Loan" }, { id: "cash", label: "Cash" }].concat(bpLeaseAvailable(card) ? [{ id: "lease", label: "Lease" }] : []),
                  leasing ? "lease" : s.pay.mode)}</div>
          ${leasing ? `
            <p class="bpf-calc-h">Your lease</p>
            <div class="bpf-calc-row"><span>Due at signing</span>
              ${leaseSeg("leaseDue", BP_LEASE_DUE.map(v => ({ id: v, label: v ? "$" + (v / 1000) + "K" : "$0" })), lease.leaseDue)}</div>
            <div class="bpf-calc-row"><span>Length</span>
              ${leaseSeg("leaseTerm", BP_LEASE_TERMS.map(v => ({ id: v, label: String(v) })), lease.leaseTerm)}</div>
            <div class="bpf-calc-row"><span>Miles a year</span>
              ${leaseSeg("leaseMiles", BP_LEASE_MILES.map(v => ({ id: v, label: (v / 1000) + "K" })), lease.leaseMiles)}</div>
            <div class="bpf-calc-row bpf-calc-stack"><span>Credit score we used</span>
              ${seg("credit", (cr.order || []).map(t => ({ id: t, label: (cr.labels || {})[t] || t })), s.pay.credit)}</div>
            <div class="bpf-calc-row bpf-calc-out"><span>Lease payment</span>
              <strong>${h(bpMoney(fig.payment))}</strong></div>` : loan ? `
            <div class="bpf-calc-row"><span>Down payment</span>
              ${seg("down", (fin.downOptions || [0.1, 0.2]).map(d => ({ id: d, label: Math.round(d * 100) + "%" })), s.pay.down)}</div>
            <p class="bpf-calc-h">Your loan</p>
            <div class="bpf-calc-row"><span>Length</span>
              ${seg("term", (fin.terms || [36, 48, 60, 72]).map(t => ({ id: t, label: String(t) })), s.pay.term)}</div>
            <div class="bpf-calc-row bpf-calc-stack"><span>Credit score we used</span>
              ${seg("credit", (cr.order || []).map(t => ({ id: t, label: (cr.labels || {})[t] || t })), s.pay.credit)}</div>
            <div class="bpf-calc-row bpf-calc-out"><span>Car payment, ${h(bpPct(fig.b.pay.apr))}</span>
              <strong>${h(bpMoney(fig.payment))}</strong></div>` : ""}
          <p class="bpf-calc-h">Running it, each month</p>
          ${input("insurance", val("insurance"), "Insurance")}
          ${input("fuel", val("fuel"), fuelLabel)}
          ${input("upkeep", val("upkeep"), "Upkeep and repairs")}
          <div class="bpf-calc-row bpf-calc-out"><span>Running it</span><strong>${h(bpMoney(fig.running))}</strong></div>
          <div class="bpf-calc-total">
            <div><span>Total monthly</span><strong>${h(bpMoney(fig.monthly))}</strong></div>
            <div><span>Year 1</span><strong>${h(bpMoney(fig.year1))}</strong></div>
            <div><span>5 years</span><strong>${h(bpMoney(fig.five))}</strong></div>
          </div>
          ${edited ? `<button class="bp-link" type="button" onclick="bpfCalcReset()">Put my estimates back</button>` : ""}
        </div>
        ${bubble(leasing
          ? "Total monthly is the lease payment plus running it. Year 1 is what you pay at signing, 12 payments and 12 months of running it. Five years repeats the lease. The payment is an estimate."
          : loan
          ? "Total monthly is the car payment plus running it. Year 1 is the down payment, 12 payments and 12 months of running it. Five years adds up the price, taxes and fees, running it and the loan interest."
          : "Total monthly is what it costs to run. Year 1 is the price, taxes and fees, and 12 months of running it. Five years adds up the price, taxes and fees, and running it.")}
        ${bubble("Fuel is worked out from " + bpVMilesLine().replace(/^Based on the /, "the ").replace(/^Estimated at /, "") +
                 ". Insurance is full coverage in " + bpVState().name + ".")}
      </div>
      <div class="esf-buddy-foot">
        <div class="esf-buddy-bar">
          <button class="esf-buddy-x" type="button" onclick="bpBuddyClose()" aria-label="Close">&times;</button>
          <span class="esf-buddy-inputwrap" onclick="bpBuddyInputTapped()">
            <input class="esf-buddy-input" type="text" disabled aria-disabled="true"
                   tabindex="-1" placeholder="Or type a question...">
          </span>
        </div>
      </div>
    </div>`;
}

// ── Admin ────────────────────────────────────────────────────────────────────

function renderBpFinderAdmin() {
  const f = bpfSession();
  const p = bpfPeer();
  const sel = bpfSelected();
  const r = bpfQuizResult();
  return `
    <div class="admin-card">
      <p class="admin-card-title">Big purchase — find your car</p>
      <p class="helper">View <code>${h(f.view)}</code> · path ${h(f.path || "none")} ·
        pick ${sel ? h(bpfName(sel.model) + " (" + sel.cond + ")") : "none"}</p>
      <p class="helper">Peers (${h(p.band)}, household ${p.household}): payment ${h(bpMoney(p.payment))},
        running ${h(bpMoney(p.running))}, total ${h(bpMoney(p.total))}</p>
      <p class="helper">Income ${h(bpMoney(bpfIncomeMonthly()))}/mo · quiz scores
        <code>${h(JSON.stringify(r.scores))}</code></p>
      <p class="helper" style="font-size:10px;">Catalog, quiz and peer figures:
        <code>big-purchase.json → vehicle.finder / peerSpend</code>.</p>
      <button class="button secondary" style="width:100%;font-size:11px;" type="button"
              onclick="bpfChoose('4runner','new')">Jump: Toyota 4Runner, new</button>
    </div>
    ${renderBpAdminCommon()}`;
}
