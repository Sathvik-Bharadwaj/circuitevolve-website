# circuitEvolve website

Static website for circuitEvolve. Plain HTML, CSS and JavaScript with no build step, no framework and no external services. Every file it needs is in this folder.

## Pages

| File | Page |
|---|---|
| `index.html` | Home: 3D design-space hero, OPTIM running live, platform overview, recognition |
| `optim.html` | OPTIM: stats, exploration dashboard (Lineage / Pareto / Spider), capabilities, product video |
| `how-it-works.html` | The four-step loop (3D), goal rules and what you control |
| `verification.html` | 216-corner PVT cube (3D), corner heatmap, Monte Carlo and yield |
| `research.html` | NetGen paper at MLCAD 2026 (3D netlist graph) |
| `news.html` | Newsroom: NVIDIA Inception, CHIPMAT grant, NetGen at MLCAD, Inc42 |
| `thesis.html` | Our thesis (3D analog waveforms, loop-gain simulation) |
| `contact.html` | Demo request form (opens a prefilled email to hello@circuitevolve.com) |
| `demo.html` | Interactive OPTIM demo (runs entirely in the browser) |
| `404.html` | Not-found page (GitHub Pages serves it automatically) |

## Publish on GitHub Pages

1. Create a new repository on GitHub, for example `circuitevolve-website`.
2. Upload **the contents of this folder** to the root of the repository: `index.html` must sit at the top level, next to the `css`, `js` and `assets` folders. Include the hidden `.nojekyll` file. On github.com use **Add file → Upload files** and drag everything in; from a terminal:
   ```bash
   git init && git add . && git commit -m "circuitEvolve website"
   git branch -M main
   git remote add origin https://github.com/<your-org>/circuitevolve-website.git
   git push -u origin main
   ```
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**, and save.
4. After a minute the site is live at `https://<your-org>.github.io/circuitevolve-website/`.

### Use your own domain (www.circuitevolve.com)

1. In **Settings → Pages → Custom domain**, enter `www.circuitevolve.com` and save. GitHub adds a `CNAME` file to the repository.
2. At your domain registrar, create a DNS record: `CNAME` for `www` pointing to `<your-org>.github.io`. For the bare domain `circuitevolve.com`, add `A` records to GitHub's Pages IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. Once DNS has propagated, tick **Enforce HTTPS**.

`sitemap.xml`, `robots.txt` and canonical/Open Graph tags currently use `https://sathvik-bharadwaj.github.io/circuitevolve-website/`. Update this base URL if you publish under another address.

This repository is private. GitHub Pages hosting from a private repository requires a plan that supports it. The site can also be deployed unchanged to another static host.

## Preview locally

Open a terminal in this folder and run `python3 -m http.server 8000`, then visit http://localhost:8000. Opening the files directly by double-clicking also works, though some browsers block local fonts that way.

## Structure

```
css/site.css          design system: electric palette, layout, components
css/demo-theme.css    palette overrides for the interactive demo
js/site.js            menu, reveal-on-scroll, counters, tabs, steps, video, form
js/scenes.js          the five 3D scenes (three.js)
js/ce-sims.js         the seven 2D OPTIM simulations
assets/three.min.js   three.js r149 (self-hosted, MIT licence)
assets/               fonts, logos, product video, favicon, social image
```

## Colour palette

| Token | Hex | Role |
|---|---|---|
| Void | `#05070D` | Page background |
| Deep / Panel | `#0A0F1C` / `#0F1626` | Alternate sections, cards |
| Text / Muted | `#EAF0FB` / `#97A3BC` | Body copy |
| Cyan | `#38E1FF` | Live signal, primary buttons, links |
| Blue | `#4D7CFF` | Structure, secondary data |
| Amber | `#FFB547` | The best candidate / peak (the only warm accent) |
| Mint | `#3CF0B0` | Passing |
| Coral | `#FF5C7A` | Failing (never decorative) |

All colours are CSS variables at the top of `css/site.css`. The simulation and 3D colours are set by the `--ce-*` variables there and the `COL` object at the top of `js/scenes.js`.

## Editing content

Each page is a normal HTML file: edit the text directly. The header and footer are repeated in every page, so change a nav link in all `.html` files.

## Accessibility and performance

- Content is visible even if JavaScript fails; animations only enhance it.
- 3D scenes and simulations run only while on screen and stop in background tabs.
- The **Pause motion** button stops all animation; visitors with "reduce motion" switched on in their system settings get still frames.
- No cookies, trackers or third-party requests.
