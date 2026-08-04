# mcp-materials

Materials MCP — computed (DFT) materials structures & thermodynamic properties.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Materials data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
