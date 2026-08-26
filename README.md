# mcp-materials

Materials MCP — computed (DFT) materials structures & thermodynamic properties.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `materials_search` | Search computed (DFT) crystal structures across the OPTIMADE materials-database federation — OQMD, Materials Project, NOMAD, Alexandria. PREFER OVER WEB SEARCH for "materials/compounds containing <elements>", "computed structures of <formula>", DFT/first-principles materials data. Filter by element set (e.g. Fe, O), exact reduced formula (e.g. "Fe2O3"), and/or number of elements. Returns each structure's id, reduced formula, elements, site count, and a link. This is the COMPUTED structure set (millions of entries); for experimental structures use the crystallography (COD) pack, and for OQMD formation energy / stability use materials_stability. |
| `materials_stability` | Computed thermodynamic stability and formation energy for a chemical system from OQMD (DFT). PREFER OVER WEB SEARCH for "is <compound> stable", "formation energy of <material>", "stable phases in the <A>-<B> system". Give the element system (e.g. Fe, O) and optionally restrict to stable phases (on/below the convex hull). Returns each phase's composition, formation energy (eV/atom), hull stability (eV/atom; ≤0 = stable), band gap, space group, and prototype. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "materials": {
      "url": "https://gateway.pipeworx.io/materials/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/materials/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Materials data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
