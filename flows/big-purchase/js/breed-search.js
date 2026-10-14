// ─── Breed search ────────────────────────────────────────────────────────────
// v4 only. Turns whatever a tester types into a set of body-type ids, so the
// creator's first step can filter its grid down to the shapes that fit their
// actual dog.
//
// The problem it solves: a tester knows "she's a husky-corgi mix". They do not
// know, and should not have to work out, which of nine silhouettes that is.
//
// Pure functions, no DOM — the screen calls breedMatch() and paints the result.
// Data is data (data/dog-breeds.json, 380 breeds and ~1,100 search terms);
// the matching is here where it can be tested.
//
// ── HOW A MIX RESOLVES, which is the whole point ────────────────────────────
// "half husky half corgi" is TWO breeds, so it offers BOTH parents' types —
// spitz and low-set — plus anything the cross itself commonly throws that
// neither parent shows. Short legs are dominant, so a low-set parent crossed
// with anything tends to produce low-set pups; the `crosses` table in the JSON
// carries those additions. The tester picks the one that actually looks like
// their dog, which is the only thing they can judge better than we can.
//
// Named crosses are their own entries: "labradoodle" must not be parsed as a
// mix of "labra" and "doodle".

function breedData() {
  return (typeof DOG_BREEDS !== "undefined" && DOG_BREEDS) || null;
}

/** Lowercase, punctuation to spaces, whitespace collapsed. */
function breedNormalize(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalized words with the filler stripped — "half", "mix", "x", "puppy"… */
function breedTokens(s) {
  const d = breedData();
  const fillers = (d && d.fillers) || [];
  return breedNormalize(s).split(" ").filter(function (w) {
    return w && fillers.indexOf(w) === -1;
  });
}

/** Body type for one breed row: its own override, else its group's default. */
function breedBodies(row) {
  if (!row) return [];
  if (row.body && row.body.length) return row.body.slice();
  const d = breedData();
  const byGroup = (d && d.groupBody) || {};
  const b = byGroup[row.group];
  return b ? [b] : [];
}

/** Every searchable string for a row — its name and its aliases, normalized. */
function breedTermsFor(row) {
  const terms = [breedNormalize(row.name)];
  (row.aliases || []).forEach(function (a) { terms.push(breedNormalize(a)); });
  return terms.filter(Boolean);
}

/** The rows, skipping the `_note` entries that sit inline in the JSON. */
function breedRows() {
  const d = breedData();
  return ((d && d.breeds) || []).filter(function (r) { return r && r.name; });
}

/**
 * Does this row match the query?
 *
 * Four passes, loosest last, so an exact name always beats a prefix on some
 * other breed: exact term · term contains the query · query contains the term
 * (that is how "german shepherd puppy" finds the breed) · every query token
 * appears somewhere in the term.
 *
 * Returns a rank, lower is better, or -1 for no match. The rank matters because
 * "collie" should surface Collie before Border Collie.
 */
function breedRank(row, query, tokens) {
  const terms = breedTermsFor(row);
  let best = -1;
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    let rank = -1;
    if (t === query) rank = 0;
    else if (query && t.indexOf(query) === 0) rank = 1;
    // WORD-BOUNDED, not a bare substring. A plain indexOf here let "asdfgh"
    // match the Australian Shepherd, because its alias "asd" happens to sit
    // inside that nonsense -- three-letter aliases turn any typo into a hit.
    else if (query && breedHasPhrase(query, t) && t.length >= 3) rank = 2;
    else if (query && t.indexOf(query) !== -1 && query.length >= 3) rank = 3;
    else if (tokens.length && tokens.every(function (w) { return t.indexOf(w) !== -1; })) rank = 4;
    if (rank !== -1 && (best === -1 || rank < best)) best = rank;
  }
  return best;
}

/** Does `phrase` appear in `hay` as whole words? Padding makes the test cheap. */
function breedHasPhrase(hay, phrase) {
  return (" " + hay + " ").indexOf(" " + phrase + " ") !== -1;
}

/** "spitz" + "low_set" → the crosses key, order-independent. */
function breedCrossKey(a, b) {
  return [a, b].sort().join("+");
}

/**
 * Everything a query resolves to.
 *
 *   { query, generic, breeds: [names], bodies: [ids], crossAdded: [ids] }
 *
 * `generic` is true for "mutt", "rescue", "no idea" — someone who knows their
 * dog is a mix and nothing more. The caller shows all nine: narrowing would be
 * a guess dressed as an answer.
 *
 * An empty or unmatched query returns no bodies, and the caller shows all nine
 * rather than an empty grid (D19 — no screen renders empty).
 */
function breedMatch(query) {
  const q = breedNormalize(query);
  const out = { query: q, generic: false, breeds: [], bodies: [], crossAdded: [] };
  if (!q) return out;

  const d = breedData();
  const generics = (d && d.generic) || [];
  for (let i = 0; i < generics.length; i++) {
    const g = breedNormalize(generics[i]);
    if (g && (q === g || q.indexOf(g) !== -1)) { out.generic = true; return out; }
  }

  const tokens = breedTokens(q);
  const hits = [];
  breedRows().forEach(function (row) {
    const rank = breedRank(row, q, tokens);
    if (rank !== -1) hits.push({ row: row, rank: rank });
  });
  if (!hits.length) return out;

  hits.sort(function (a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.row.name.length - b.row.name.length;   // shorter name = less specific qualifier
  });

  // ── WHICH HITS COUNT AS "the breeds they typed" ───────────────────────────
  // A one-word query ("collie") can match a dozen rows; listing all of them as
  // parents would union half the body types and filter nothing. So only hits at
  // the BEST rank are treated as named breeds — plus, for a genuine multi-breed
  // query, the best hit for each separate token group.
  const bestRank = hits[0].rank;
  const chosen = [];
  const seen = {};
  hits.forEach(function (hAlt) {
    if (hAlt.rank !== bestRank) return;
    if (seen[hAlt.row.name]) return;
    seen[hAlt.row.name] = true;
    chosen.push(hAlt.row);
  });

  // Multi-breed: try each token on its own and keep its best hit. That is what
  // makes "half husky half corgi" two breeds rather than one loose match.
  //
  // "blue heeler" is an exact alias of the Cattle Dog, and this pass run naively
  // over it dragged in the Blue Lacy on the word "blue"; "german shepard" pulled
  // in the Boxer on "german". The covered() test below is what stops that -- a
  // token already inside a matched breed's own name is not a second breed.
  //
  // There WAS a second guard here (skip the pass entirely unless the whole query
  // matched loosely). Mutation testing showed removing it changed no result:
  // covered() already subsumes it. Two conditions where one does the work is one
  // nobody can reason about, so it went.
  if (tokens.length > 1) {
    // A token already accounted for by a breed we picked is not a second breed.
    // "bernese mountain dog puppy" matched the Bernese, and hunting "mountain"
    // on its own then dragged in the Mountain Cur -- a qualifier inside a name
    // read as a breed of its own.
    const covered = function (tok) {
      return chosen.some(function (row) {
        return breedTermsFor(row).some(function (t) { return t.indexOf(tok) !== -1; });
      });
    };
    tokens.forEach(function (tok) {
      if (tok.length < 3 || covered(tok)) return;
      let best = null;
      breedRows().forEach(function (row) {
        const r = breedRank(row, tok, [tok]);
        if (r === -1 || r > 1) return;            // exact or prefix only, per token
        if (!best || r < best.rank || (r === best.rank && row.name.length < best.row.name.length)) {
          best = { row: row, rank: r };
        }
      });
      if (best && !seen[best.row.name]) { seen[best.row.name] = true; chosen.push(best.row); }
    });
  }

  const bodySeen = {};
  chosen.forEach(function (row) {
    out.breeds.push(row.name);
    breedBodies(row).forEach(function (b) {
      if (!bodySeen[b]) { bodySeen[b] = true; out.bodies.push(b); }
    });
  });

  // ── What the cross itself throws, beyond either parent ────────────────────
  const crosses = (d && d.crosses) || {};
  const base = out.bodies.slice();
  for (let i = 0; i < base.length; i++) {
    for (let j = i + 1; j < base.length; j++) {
      const extra = crosses[breedCrossKey(base[i], base[j])] || [];
      extra.forEach(function (b) {
        if (!bodySeen[b]) {
          bodySeen[b] = true;
          out.bodies.push(b);
          out.crossAdded.push(b);
        }
      });
    }
  }

  return out;
}

/**
 * The body-type ids to SHOW for a query — the filter the grid actually applies.
 * Empty query, a generic answer, or no match at all → every type, never a blank
 * grid.
 */
function breedVisibleBodies(query) {
  const all = (typeof BUDDY_BODY_TYPES !== "undefined" ? BUDDY_BODY_TYPES : [])
    .map(function (t) { return t.id; });
  const m = breedMatch(query);
  if (!m.bodies.length) return all;
  // The prototype is the only one with art behind it, so it stays offered
  // whatever the filter says — a tester must always be able to pick the buddy
  // that actually exists.
  const keep = m.bodies.slice();
  if (typeof BUDDY_PROTOTYPE !== "undefined" && keep.indexOf(BUDDY_PROTOTYPE) === -1) {
    keep.unshift(BUDDY_PROTOTYPE);
  }
  return all.filter(function (id) { return keep.indexOf(id) !== -1; });
}
