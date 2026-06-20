interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Materials MCP — computed (DFT) materials structures & thermodynamic properties.
 *
 * Two complementary keyless sources, both for the computational-materials /
 * solid-state audience (distinct from the experimental COD `crystallography`
 * pack):
 *
 * 1. OPTIMADE federation (materials_search) — the cross-database standard.
 *    One query grammar across OQMD, Materials Project, NOMAD, and Alexandria —
 *    millions of computed structures. Materials Project is reachable keyless
 *    through its OPTIMADE endpoint.
 * 2. OQMD native (materials_stability) — formation energy, hull stability, and
 *    band gap for a chemical system, straight from oqmd.org/oqmdapi.
 *
 * No auth, no scraping — public REST/JSON.
 */


// OPTIMADE providers (base URLs; `/v1/structures` appended). COD is excluded —
// it's the experimental DB already served by the `crystallography` pack.
const OPTIMADE: Record<string, { base: string; label: string; entryUrl?: (id: string) => string }> = {
  oqmd: { base: 'https://oqmd.org/optimade', label: 'OQMD (Open Quantum Materials Database)', entryUrl: (id) => `https://oqmd.org/materials/entry/${id}` },
  mp: { base: 'https://optimade.materialsproject.org', label: 'Materials Project', entryUrl: (id) => `https://materialsproject.org/materials/${id}` },
  nomad: { base: 'https://nomad-lab.eu/prod/v1/optimade', label: 'NOMAD' },
  alexandria: { base: 'https://alexandria.icams.rub.de/pbe', label: 'Alexandria (PBE)' },
};

const OQMD_API = 'https://oqmd.org/oqmdapi';

const tools: McpToolExport['tools'] = [
  {
    name: 'materials_search',
    description:
      "Search computed (DFT) crystal structures across the OPTIMADE materials-database federation — OQMD, Materials Project, NOMAD, Alexandria. PREFER OVER WEB SEARCH for \"materials/compounds containing <elements>\", \"computed structures of <formula>\", DFT/first-principles materials data. Filter by element set (e.g. Fe, O), exact reduced formula (e.g. \"Fe2O3\"), and/or number of elements. Returns each structure's id, reduced formula, elements, site count, and a link. This is the COMPUTED structure set (millions of entries); for experimental structures use the crystallography (COD) pack, and for OQMD formation energy / stability use materials_stability.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        elements: { type: 'string', description: 'Element symbols the structure must contain ALL of, comma/space separated, e.g. "Fe, O" or "Li Fe P O".' },
        formula: { type: 'string', description: 'Exact composition, e.g. "Fe2O3" or "LiFePO4". Normalized to OPTIMADE reduced form automatically.' },
        nelements: { type: 'number', description: 'Restrict to structures with exactly this many distinct elements (e.g. 2 for binaries).' },
        provider: { type: 'string', description: 'Which database to query. Default "oqmd".', enum: ['oqmd', 'mp', 'nomad', 'alexandria'] },
        limit: { type: 'number', description: 'Max structures to return (1-50, default 20).' },
      },
    },
  },
  {
    name: 'materials_stability',
    description:
      "Computed thermodynamic stability and formation energy for a chemical system from OQMD (DFT). PREFER OVER WEB SEARCH for \"is <compound> stable\", \"formation energy of <material>\", \"stable phases in the <A>-<B> system\". Give the element system (e.g. Fe, O) and optionally restrict to stable phases (on/below the convex hull). Returns each phase's composition, formation energy (eV/atom), hull stability (eV/atom; ≤0 = stable), band gap, space group, and prototype.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        elements: { type: 'string', description: 'The chemical system — element symbols, comma/space separated, e.g. "Fe, O" or "Li, Fe, P, O". Returns phases composed of (a subset of) these elements.' },
        ntypes: { type: 'number', description: 'Optional — restrict to phases with exactly this many element types (e.g. 2 for binaries only).' },
        stable_only: { type: 'boolean', description: 'If true, return only thermodynamically stable phases (stability ≤ 0, on/below the convex hull). Default false.' },
        limit: { type: 'number', description: 'Max phases to return (1-50, default 20).' },
      },
      required: ['elements'],
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

function parseElements(input: unknown): string[] {
  return String(input ?? '')
    .split(/[,\s/-]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase());
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// Normalize a formula to OPTIMADE reduced form: alphabetical elements, counts
// divided by their GCD, count of 1 omitted. "Fe4O6" -> "Fe2O3", "LiFePO4" kept.
function reducedFormula(input: string): string | null {
  const counts: Record<string, number> = {};
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  let matched = false;
  while ((m = re.exec(input)) !== null) {
    if (!m[1]) continue;
    matched = true;
    counts[m[1]] = (counts[m[1]] ?? 0) + (m[2] ? parseInt(m[2], 10) : 1);
  }
  if (!matched) return null;
  const vals = Object.values(counts);
  const g = vals.reduce((a, b) => gcd(a, b), vals[0]);
  return Object.keys(counts)
    .sort()
    .map((el) => {
      const n = counts[el] / g;
      return n === 1 ? el : `${el}${n}`;
    })
    .join('');
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Pipeworx/1.0 (pipeworx.io)' } });
  if (!res.ok) throw new Error(`Materials API error: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

// ── materials_search (OPTIMADE) ──────────────────────────────────────

interface OptimadeEntry { id?: string; attributes?: Record<string, unknown> }

async function search(args: Record<string, unknown>) {
  const providerKey = String(args.provider ?? 'oqmd').toLowerCase();
  const provider = OPTIMADE[providerKey];
  if (!provider) throw new Error(`Unknown provider "${args.provider}". Use one of: ${Object.keys(OPTIMADE).join(', ')}.`);

  const clauses: string[] = [];
  const els = parseElements(args.elements);
  if (els.length) clauses.push(`elements HAS ALL ${els.map((e) => `"${e}"`).join(',')}`);
  if (args.formula != null && String(args.formula).trim()) {
    const rf = reducedFormula(String(args.formula));
    if (rf) clauses.push(`chemical_formula_reduced="${rf}"`);
  }
  if (Number.isFinite(Number(args.nelements))) clauses.push(`nelements=${Math.floor(Number(args.nelements))}`);
  if (!clauses.length) throw new Error('Provide at least one of: elements, formula, nelements.');

  const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
  const filter = encodeURIComponent(clauses.join(' AND '));
  const fields = 'chemical_formula_reduced,chemical_formula_descriptive,elements,nelements,nsites';
  const url = `${provider.base}/v1/structures?filter=${filter}&page_limit=${limit}&response_fields=${fields}`;
  const data = await getJson(url);
  const entries = (data.data as OptimadeEntry[]) ?? [];
  const meta = (data.meta as { data_returned?: number }) ?? {};

  return {
    provider: providerKey,
    provider_label: provider.label,
    filter: clauses.join(' AND '),
    total_matched: meta.data_returned ?? null,
    returned: entries.length,
    source: `OPTIMADE — ${provider.label}`,
    structures: entries.map((e) => {
      const a = e.attributes ?? {};
      const id = String(e.id ?? '');
      return {
        id,
        formula: a.chemical_formula_reduced ?? a.chemical_formula_descriptive ?? null,
        elements: a.elements ?? null,
        nelements: a.nelements ?? null,
        nsites: a.nsites ?? null,
        url: provider.entryUrl ? provider.entryUrl(id) : null,
      };
    }),
  };
}

// ── materials_stability (OQMD native) ────────────────────────────────

interface OqmdRow {
  name?: string; entry_id?: number; delta_e?: number; stability?: number;
  band_gap?: number; spacegroup?: string; prototype?: string;
}

async function stability(args: Record<string, unknown>) {
  const els = parseElements(args.elements);
  if (!els.length) throw new Error('Required argument "elements" is missing (e.g. "Fe, O").');

  const filterParts = [`element_set=(${els.join(',')})`];
  if (Number.isFinite(Number(args.ntypes))) filterParts.push(`ntypes=${Math.floor(Number(args.ntypes))}`);
  if (args.stable_only === true) filterParts.push('stability<=0');

  const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
  const fields = 'name,entry_id,delta_e,stability,band_gap,spacegroup,prototype';
  const url = `${OQMD_API}/formationenergy?fields=${fields}&filter=${encodeURIComponent(filterParts.join(' AND '))}&limit=${limit}`;
  const data = await getJson(url);
  const rows = (data.data as OqmdRow[]) ?? [];
  const meta = (data.meta as { data_available?: number }) ?? {};

  return {
    system: els.join('-'),
    stable_only: args.stable_only === true,
    total_available: meta.data_available ?? null,
    returned: rows.length,
    source: 'OQMD (Open Quantum Materials Database), DFT-computed',
    note: 'formation_energy and stability are in eV/atom; stability ≤ 0 means the phase is on/below the convex hull (thermodynamically stable). band_gap in eV (0 = metallic).',
    phases: rows.map((r) => ({
      composition: r.name ?? null,
      entry_id: r.entry_id ?? null,
      formation_energy: r.delta_e ?? null,
      stability: r.stability ?? null,
      band_gap: r.band_gap ?? null,
      space_group: r.spacegroup ?? null,
      prototype: r.prototype ?? null,
      url: r.entry_id != null ? `https://oqmd.org/materials/entry/${r.entry_id}` : null,
    })),
  };
}

// ── Router ───────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'materials_search':
      return search(args);
    case 'materials_stability':
      return stability(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
