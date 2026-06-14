/**
 * generate-catalog.mjs
 *
 * Reads next-app/registry.json and next-app/registry/<id>/module.manifest.json
 * for each item, then emits:
 *   - dev-docs/modules/index.md  — catalog overview page
 *   - dev-docs/modules/<id>.md   — per-module detail page
 *
 * Run before `vitepress build` via the `build` npm script.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ROOT = resolve(__dirname, '../..')
const REGISTRY_JSON = join(ROOT, 'next-app/registry.json')
const MODULES_OUT = join(__dirname, '../modules')

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function moduleIcon(id) {
  const icons = {
    landing: '🏠',
    account: '👤',
    admin: '🛡️',
    billing: '💳',
    'hello-module': '👋',
  }
  return icons[id] ?? '📦'
}

function moduleTags(manifest) {
  const tags = []
  if (manifest?.dbTables?.length) tags.push('Database')
  if (manifest?.serverActions?.length) tags.push('Server Actions')
  if (manifest?.envVars?.length) tags.push('Env Vars')
  if (manifest?.registryDependencies?.some((d) => d.includes('auth'))) tags.push('Auth Required')
  if (manifest?.registryDependencies?.some((d) => d.includes('rbac'))) tags.push('RBAC')
  return tags
}

function generateModulePage(item, manifest) {
  const id = item.name
  const title = item.title ?? manifest?.title ?? id
  const summary = item.description ?? manifest?.summary ?? ''
  const icon = moduleIcon(id)
  const tags = moduleTags(manifest)
  const routes = manifest?.routes ?? []
  const serverActions = manifest?.serverActions ?? []
  const dbTables = manifest?.dbTables ?? []
  const envVars = manifest?.envVars ?? []
  const deps = manifest?.registryDependencies ?? item.registryDependencies ?? []
  const postInstall = manifest?.postInstall ?? []
  const demoIframeSrc = manifest?.demo?.iframeSrc ?? ''
  const demoPath = manifest?.demo?.path ?? '/'
  const apiDemoPath = manifest?.demo?.apiDemoPath ?? '/api/health'

  const tagsStr = tags.length
    ? tags.map((t) => `<span class="module-card-tag">${t}</span>`).join(' ')
    : ''

  const routesList = routes.length
    ? routes.map((r) => `- \`${r}\``).join('\n')
    : '_No routes_'

  const actionsList = serverActions.length
    ? serverActions.map((a) => `- \`${a}\``).join('\n')
    : '_No server actions_'

  const installCmd = `npx shadcn@latest add @saas/${id}`

  return `---
title: "${title} Module"
description: "${summary}"
---

# ${icon} ${title}

<div class="module-card-tags" style="margin-bottom: 1rem;">${tagsStr}</div>

> **Module ID:** \`@saas/${id}\` | **Version:** ${manifest?.version ?? '1.0.0'}

${summary}

## Installation

\`\`\`bash
${installCmd}
\`\`\`

${
  deps.length
    ? `## Dependencies

${deps.map((d) => `- \`${d}\``).join('\n')}

`
    : ''
}## Routes

${routesList}

## Server Actions

${actionsList}

${
  dbTables.length
    ? `## Database Tables

${dbTables.map((t) => `- \`${t}\``).join('\n')}

`
    : ''
}${
  envVars.length
    ? `## Environment Variables

${envVars.map((e) => `- \`${e}\``).join('\n')}

`
    : ''
}${
  postInstall.length
    ? `## Post-Install Steps

${postInstall
  .map(
    (step) => `**Step ${step.step}** (${step.action}): ${step.description}${
      step.command ? `\n\`\`\`bash\n${step.command}\n\`\`\`` : ''
    }`
  )
  .join('\n\n')}

`
    : ''
}## Live Demo

<DemoIframe path="${demoPath}" title="${title} — Live Demo" :height="550" />

## API Demonstration

<ApiPlayground
  defaultEndpoint="${apiDemoPath}"
  defaultMethod="GET"
  liveAppPath="${demoPath}"
/>

> **Server Actions note:** Server Actions (\`"use server"\`) are not callable
> cross-origin. Use the "Try in Live App" link above to interact with them.
`
}

function generateIndexPage(items, manifests) {
  const cards = items
    .filter((item) => item.name !== 'hello-module')
    .map((item) => {
      const manifest = manifests[item.name]
      const id = item.name
      const title = item.title ?? manifest?.title ?? id
      const summary = item.description ?? manifest?.summary ?? ''
      const icon = moduleIcon(id)
      const tags = moduleTags(manifest)

      return `<ModuleCard
  id="${id}"
  title="${title}"
  summary="${summary}"
  icon="${icon}"
  :tags="${JSON.stringify(tags).replace(/"/g, "'")}"
  docsPath="/modules/${id}"
  demoPath="/demo/${id}"
/>`
    })
    .join('\n\n')

  return `---
title: Module Catalog
description: Browse all @saas registry modules — installable building blocks for your Next.js SaaS.
---

# Module Catalog

Browse and install @saas registry modules. Each module is an installable block
that wires routes, server actions, and database tables into your Next.js app via
the shadcn registry protocol.

\`\`\`bash
# Install any module
npx shadcn@latest add @saas/<module-id>
\`\`\`

## Phase 56 Modules

<div class="module-catalog">

${cards}

</div>

## How Modules Work

1. **Declare** — each module ships a \`module.manifest.json\` declaring its routes,
   server actions, DB tables, env vars, and post-install steps.
2. **Install** — run \`npx shadcn@latest add @saas/<id>\` to copy files into your
   \`next-app/\`.
3. **Wire** — follow the post-install steps (sidebar nav, auth primitives, etc.)
4. **Extend** — override components, add routes, build on top.

## Build Check

The \`pnpm registry:build\` command validates that every shipped module has:
- A \`module.manifest.json\` with \`docs\` + \`demo\` fields
- A docs page in \`dev-docs/modules/<id>.md\`
- A demo entry in \`dev-docs/demo/<id>.md\`
`
}

// ---- main ----

const registry = readJson(REGISTRY_JSON)
if (!registry) {
  console.error('Could not read registry.json at', REGISTRY_JSON)
  process.exit(1)
}

const { items = [] } = registry

// Load manifests
const manifests = {}
for (const item of items) {
  const manifestPath = join(ROOT, `next-app/registry/${item.name}/module.manifest.json`)
  const manifest = readJson(manifestPath)
  if (manifest) {
    manifests[item.name] = manifest
  }
}

// Ensure output dir exists
if (!existsSync(MODULES_OUT)) {
  mkdirSync(MODULES_OUT, { recursive: true })
}

// Generate index
const indexContent = generateIndexPage(items, manifests)
writeFileSync(join(MODULES_OUT, 'index.md'), indexContent, 'utf8')
console.log('[catalog] wrote modules/index.md')

// Generate per-module pages
for (const item of items) {
  if (item.name === 'hello-module') continue
  const manifest = manifests[item.name]
  const pageContent = generateModulePage(item, manifest)
  writeFileSync(join(MODULES_OUT, `${item.name}.md`), pageContent, 'utf8')
  console.log(`[catalog] wrote modules/${item.name}.md`)
}

console.log('[catalog] done — generated', items.filter((i) => i.name !== 'hello-module').length, 'module pages')
