import { loadEnvConfig } from '@next/env'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getEnv } from '../lib/env'

loadEnvConfig(process.cwd())

type OpenClawConfig = {
  agents?: {
    defaults?: Record<string, unknown>
    list?: Array<Record<string, unknown>>
  }
  bindings?: Array<Record<string, unknown>>
  channels?: {
    telegram?: {
      enabled?: boolean
      accounts?: Record<string, Record<string, unknown>>
      defaultAccount?: string
    }
  }
  skills?: {
    entries?: Record<string, { env?: Record<string, string> }>
    install?: Record<string, unknown>
  }
}

function readArgument(flag: string) {
  const index = process.argv.findIndex((item) => item === flag)
  if (index === -1) {
    return null
  }

  return process.argv[index + 1] ?? null
}

async function ensureSeedFiles(agentDir: string, sourceDir: string) {
  await fs.mkdir(agentDir, { recursive: true })

  for (const fileName of ['auth-profiles.json', 'models.json']) {
    const sourceFile = path.join(sourceDir, fileName)
    const targetFile = path.join(agentDir, fileName)

    try {
      await fs.access(targetFile)
    } catch {
      await fs.copyFile(sourceFile, targetFile)
    }
  }
}

async function ensureWorkspaceFiles(workspaceDir: string, repoRoot: string) {
  await fs.mkdir(workspaceDir, { recursive: true })
  await fs.mkdir(path.join(workspaceDir, '.openclaw'), { recursive: true })
  await fs.mkdir(path.join(workspaceDir, 'memory'), { recursive: true })
  await fs.mkdir(path.join(workspaceDir, 'skills', 'clawtok_backend'), {
    recursive: true,
  })
  await fs.mkdir(path.join(workspaceDir, 'tools'), { recursive: true })

  const filePairs: Array<[string, string]> = [
    [path.join(repoRoot, 'AGENTS.md'), path.join(workspaceDir, 'AGENTS.md')],
    [path.join(repoRoot, 'BOOTSTRAP.md'), path.join(workspaceDir, 'BOOTSTRAP.md')],
    [path.join(repoRoot, 'MEMORY.md'), path.join(workspaceDir, 'MEMORY.md')],
    [path.join(repoRoot, 'SOUL.md'), path.join(workspaceDir, 'SOUL.md')],
    [path.join(repoRoot, 'TOOLS.md'), path.join(workspaceDir, 'TOOLS.md')],
    [path.join(repoRoot, 'IDENTITY.md'), path.join(workspaceDir, 'IDENTITY.md')],
    [path.join(repoRoot, 'USER.md'), path.join(workspaceDir, 'USER.md')],
    [path.join(repoRoot, 'HEARTBEAT.md'), path.join(workspaceDir, 'HEARTBEAT.md')],
    [
      path.join(repoRoot, 'skills', 'clawtok_backend', 'SKILL.md'),
      path.join(workspaceDir, 'skills', 'clawtok_backend', 'SKILL.md'),
    ],
    [
      path.join(repoRoot, 'tools', 'clawtok-api.ps1'),
      path.join(workspaceDir, 'tools', 'clawtok-api.ps1'),
    ],
  ]

  for (const [sourceFile, targetFile] of filePairs) {
    await fs.copyFile(sourceFile, targetFile)
  }
}

async function main() {
  const env = getEnv()
  const home = os.homedir()
  const repoRoot = process.cwd()
  const workspaceDir =
    readArgument('--workspace') ??
    process.env.OPENCLAW_CLAWTOK_WORKSPACE ??
    path.join(home, 'clawd-clawtok')
  const baseUrl =
    readArgument('--base-url') ?? process.env.OPENCLAW_CLAWTOK_BASE_URL ?? 'http://localhost:3000'
  const telegramAccountId =
    readArgument('--telegram-account') ?? process.env.OPENCLAW_CLAWTOK_TELEGRAM_ACCOUNT ?? 'clawtok'
  const telegramBotToken =
    readArgument('--telegram-token') ?? process.env.OPENCLAW_CLAWTOK_TELEGRAM_TOKEN ?? null

  const configPath = path.join(home, '.openclaw', 'openclaw.json')
  const mainAgentDir = path.join(home, '.openclaw', 'agents', 'main', 'agent')
  const clawtokAgentDir = path.join(home, '.openclaw', 'agents', 'clawtok', 'agent')

  const rawConfig = await fs.readFile(configPath, 'utf8')
  const config = JSON.parse(rawConfig.replace(/^\uFEFF/, '')) as OpenClawConfig

  config.agents ??= {}
  config.agents.list ??= []
  config.bindings ??= []
  config.channels ??= {}
  config.channels.telegram ??= {}
  config.channels.telegram.accounts ??= {}
  config.skills ??= {}
  config.skills.entries ??= {}

  const existingAgentIndex = config.agents.list.findIndex((entry) => entry.id === 'clawtok')
  const agentEntry = {
    id: 'clawtok',
    name: 'ClawTok',
    workspace: workspaceDir,
    agentDir: clawtokAgentDir,
    tools: {
      allow: [
        'group:automation',
        'group:fs',
        'group:media',
        'group:memory',
        'group:runtime',
        'group:web',
        'group:ui',
        'session_status',
      ],
      deny: ['group:agents', 'group:messaging', 'group:nodes', 'group:sessions'],
    },
    skills: ['clawtok_backend'],
    identity: {
      name: 'ClawTok',
      emoji: '\ud83e\udd9e',
      theme: 'TikTok ingestion operator',
    },
  }

  if (existingAgentIndex === -1) {
    config.agents.list.push(agentEntry)
  } else {
    config.agents.list[existingAgentIndex] = {
      ...config.agents.list[existingAgentIndex],
      ...agentEntry,
    }
  }

  config.skills.entries.clawtok_backend = {
    env: {
      OPENCLAW_CLAWTOK_AGENT_KEY: env.OPENCLAW_AGENT_API_KEY,
      OPENCLAW_CLAWTOK_BASE_URL: baseUrl,
      OPENCLAW_CLAWTOK_REPO: repoRoot,
      OPENCLAW_CLAWTOK_WORKSPACE: workspaceDir,
    },
  }

  if (telegramBotToken) {
    config.channels.telegram.enabled = true
    config.channels.telegram.accounts[telegramAccountId] = {
      ...(config.channels.telegram.accounts[telegramAccountId] ?? {}),
      name: 'ClawTok',
      enabled: true,
      botToken: telegramBotToken,
      dmPolicy: 'pairing',
    }
  }

  const nextBindings = config.bindings.filter((entry) => {
    return !(
      entry.type === 'route' &&
      entry.agentId === 'clawtok' &&
      typeof entry.match === 'object' &&
      entry.match !== null &&
      (entry.match as Record<string, unknown>).channel === 'telegram'
    )
  })

  nextBindings.push({
    type: 'route',
    agentId: 'clawtok',
    match: {
      channel: 'telegram',
      accountId: telegramAccountId,
    },
  })

  config.bindings = nextBindings

  await ensureWorkspaceFiles(workspaceDir, repoRoot)
  await ensureSeedFiles(clawtokAgentDir, mainAgentDir)
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  console.log(
    `OpenClaw agent "clawtok" configured in ${workspaceDir} with base URL ${baseUrl} and telegram account ${telegramAccountId}`
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
