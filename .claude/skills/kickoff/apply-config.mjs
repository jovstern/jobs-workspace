#!/usr/bin/env node
// Merges this skill's GSD overrides into .planning/config.json. Safe to re-run.
// Usage: node apply-config.mjs <owner/repo>
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = process.argv[2]
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error('Usage: node apply-config.mjs <owner/repo>')
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const configPath = join(process.cwd(), '.planning', 'config.json')

let config
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'))
} catch {
  console.error(`Cannot read ${configPath}. Run /gsd-new-project first.`)
  process.exit(1)
}

const overrides = JSON.parse(
  readFileSync(join(here, 'gsd-config.json'), 'utf8').replaceAll('__REPO__', repo),
)

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (isObject(value)) {
      target[key] = merge(isObject(target[key]) ? target[key] : {}, value)
    } else {
      target[key] = value
    }
  }
  return target
}

// PR sections are merged by heading so sections chosen during /gsd-new-project survive.
const existingSections = config.ship?.pr_body_sections ?? []
const ourSections = overrides.ship.pr_body_sections
const ourHeadings = new Set(ourSections.map((section) => section.heading))
const sections = [
  ...existingSections.filter((section) => !ourHeadings.has(section.heading)),
  ...ourSections,
]

merge(config, overrides)
config.ship.pr_body_sections = sections

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
console.log(`Updated ${configPath} for ${repo}`)
