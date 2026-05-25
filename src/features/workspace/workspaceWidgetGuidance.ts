import type { WidgetKind } from './workspaceTypes';

export type WidgetWorkflowGuidance = {
  intent: string;
  value: string;
  next: string;
  evidence: string;
};

export const widgetWorkflowGuidance: Record<WidgetKind, WidgetWorkflowGuidance> = {
  overview: {
    intent: 'Orient the workspace',
    value: 'Start here when the workspace feels busy. It summarizes health, devices, and alerts before you open deeper surfaces.',
    next: 'Use Command Inbox for decisions or Manager to find a window.',
    evidence: 'status, devices, alerts',
  },
  graph: {
    intent: 'Read live telemetry',
    value: 'Use this to spot trend changes before opening notifications or command approvals.',
    next: 'Check Notifications when a telemetry channel changes severity.',
    evidence: 'signal trace',
  },
  audio: {
    intent: 'Inspect audio signals',
    value: 'Use this as a lightweight monitor for audio routing, preview, and mixing state.',
    next: 'Keep it beside media or live TV when checking playback issues.',
    evidence: 'waveform',
  },
  map: {
    intent: 'Track places and routes',
    value: 'Use this to keep location context visible while command, security, or delivery workflows run.',
    next: 'Pair it with Notifications or Workflow when a location needs attention.',
    evidence: 'route grid',
  },
  diagram: {
    intent: 'Understand dependencies',
    value: 'Use this to see how systems relate before approving commands that can affect multiple areas.',
    next: 'Open Integration Registry when a dependency points to a real connected system.',
    evidence: 'topology',
  },
  project: {
    intent: 'Track delivery work',
    value: 'Use this to keep implementation, review, and release work visible next to operational decisions.',
    next: 'Move blocked work into Workflow when it needs a repeatable runbook.',
    evidence: 'task lanes',
  },
  news: {
    intent: 'Watch market context',
    value: 'Use this to pick the market or signal source that drives the Trading Graph widget.',
    next: 'Double-click a market card or switch graph focus when the signal changes.',
    evidence: 'watchlist',
  },
  schedule: {
    intent: 'Plan the current day',
    value: 'Use this for time context: active blocks, routines, and upcoming shifts.',
    next: 'Stage routine changes through Agent Console or Command Inbox.',
    evidence: 'agenda',
  },
  launcher: {
    intent: 'Open workspace tools',
    value: 'Use this as the widget catalog when the top menu is too small or you want launch status.',
    next: 'Double-click a card to open or focus that widget in the workspace.',
    evidence: 'widget registry',
  },
  browser: {
    intent: 'Preview web pages',
    value: 'Use this for embedded references that should stay beside the operational workspace.',
    next: 'Open an external browser only when the page needs full browser capability.',
    evidence: 'URL preview',
  },
  'watch-video': {
    intent: 'Monitor video feeds',
    value: 'Use this for live TV, official streams, or local HLS/MP4 feeds during media workflows.',
    next: 'Switch sources first, then use Notifications if playback health degrades.',
    evidence: 'stream state',
  },
  'file-explorer': {
    intent: 'Bring in local files',
    value: 'Use this to load images, PDFs, and folders into the workspace without leaving the app.',
    next: 'Open selected files into Preview when they need inspection.',
    evidence: 'local files',
  },
  'native-app': {
    intent: 'Bridge desktop apps',
    value: 'Use this to remember and launch native tools that sit outside the browser workspace.',
    next: 'Keep launched apps paired with their related workspace widgets.',
    evidence: 'desktop hooks',
  },
  'window-manager': {
    intent: 'Manage workspace windows',
    value: 'Use this to find, pin, focus, or close widgets across main and extended workspaces.',
    next: 'Pin only the widgets that must remain visible and stable.',
    evidence: 'window state',
  },
  sheet: {
    intent: 'Inspect structured data',
    value: 'Use this for tabular snapshots, formulas, and operating numbers that support decisions.',
    next: 'Keep it near Command Inbox when numbers justify an approval.',
    evidence: 'grid values',
  },
  docs: {
    intent: 'Draft readable notes',
    value: 'Use this for briefings, documentation, and decision notes that should stay near the workflow.',
    next: 'Turn repeated decision notes into a Workflow template.',
    evidence: 'outline',
  },
  slides: {
    intent: 'Preview presentation state',
    value: 'Use this to keep a deck or briefing frame visible while building or reviewing a narrative.',
    next: 'Use Docs for detailed notes and Slides for the operator-facing frame.',
    evidence: 'slide frame',
  },
  'trading-graph': {
    intent: 'Analyze market signals',
    value: 'Use this for focused chart context after selecting a signal from Markets.',
    next: 'Use the market selector when the active ticker is no longer the main signal.',
    evidence: 'price trace',
  },
  image: {
    intent: 'Inspect visual assets',
    value: 'Use this to stage images before annotating, previewing, or referencing them in a workflow.',
    next: 'Use File Explorer or Preview when a local image needs exact inspection.',
    evidence: 'canvas',
  },
  pdf: {
    intent: 'Read documents',
    value: 'Use this for PDF review alongside approvals, workflows, or project work.',
    next: 'Extract the decision-relevant detail into Docs or Command Inbox evidence.',
    evidence: 'page preview',
  },
  video: {
    intent: 'Preview media',
    value: 'Use this to keep local or standby video context visible without switching surfaces.',
    next: 'Use Live TV for active streams and this frame for static preview state.',
    evidence: 'media frame',
  },
  '3d': {
    intent: 'Inspect local files and models',
    value: 'Use this as the general preview lane for images, PDFs, and file-backed artifacts.',
    next: 'Browse from File Explorer, then open the asset here for focused review.',
    evidence: 'file preview',
  },
  '3d-studio': {
    intent: 'Explore spatial concepts',
    value: 'Use this for the current simulated 3D authoring lane and engineering pass summaries.',
    next: 'Keep it visual only until a real Three.js/R3F preview lane is added.',
    evidence: 'simulation checks',
  },
  flow: {
    intent: 'Run repeatable workflows',
    value: 'Use this as the bridge between human workflow and agent workflow: templates, run steps, owners, and approvals.',
    next: 'Start a runbook, stage agent steps, then approve generated commands in Command Inbox.',
    evidence: 'runbook steps',
  },
  list: {
    intent: 'Track small queues',
    value: 'Use this as a compact task queue when a full workflow is unnecessary.',
    next: 'Promote repeated or approval-heavy queues into Workflow.',
    evidence: 'open items',
  },
  'command-inbox': {
    intent: 'Approve or stop actions',
    value: 'This is the execution gate. Agent proposals, workflow approval steps, and risky actions become decisions here.',
    next: 'Review reasoning, risk, expected result, then approve, reject, block, or override.',
    evidence: 'audit trail',
  },
  notifications: {
    intent: 'See what needs attention',
    value: 'Use this as the alert feed for telemetry, integrations, commands, and agent activity.',
    next: 'Acknowledge low-risk alerts or open the related command or registry surface.',
    evidence: 'live feed',
  },
  'integration-registry': {
    intent: 'Inspect connected systems',
    value: 'Use this to see real or mocked systems, device heartbeats, and control permissions.',
    next: 'Change permissions only when the role and risk model allow it.',
    evidence: 'heartbeats',
  },
  'agent-control': {
    intent: 'Inspect the AI operator',
    value: 'Use this to understand agent identity, status, jobs, permissions, usage, and recent activity.',
    next: 'Adjust permissions here, but approve actual actions in Command Inbox.',
    evidence: 'agent audit',
  },
  'agent-console': {
    intent: 'Ask Jarvis for help',
    value: 'Use this to turn an objective into explained proposals. It never executes directly.',
    next: 'Send the proposal, then approve or stop it in Command Inbox.',
    evidence: 'proposal history',
  },
  'home-systems': {
    intent: 'Operate the home',
    value: 'Use this to monitor energy, Solar PV, EV charging, AC, appliances, automation, safety, cameras, pool, tablets, and other home devices.',
    next: 'Keep monitoring here and stage real control changes through Command Inbox.',
    evidence: 'home telemetry',
  },
  goals: {
    intent: 'Define operating objectives',
    value: 'Use this as the top of the Agent OS loop: goals connect evidence, agents, workflow steps, command decisions, and audit history.',
    next: 'Create a goal, stage an agent plan, then approve or stop the generated command in Command Inbox.',
    evidence: 'goal audit',
  },
  'app-portal': {
    intent: 'Keep tools inside Mission Control',
    value: 'Use this to embed web tools when possible and launch external desktop or protocol targets without losing operating context.',
    next: 'Open Codex, Hermes bridge status, or another profile next to the goal and command surfaces.',
    evidence: 'app profile',
  },
  'json-surface': {
    intent: 'Render agent JSON',
    value: 'Use this to inspect structured output from Hermes, OpenClaw, files, or bridge payloads without writing a custom widget first.',
    next: 'Render the JSON, then stage command-like payloads through Command Inbox when needed.',
    evidence: 'json document',
  },
};

export function getWidgetWorkflowGuidance(kind: WidgetKind) {
  return widgetWorkflowGuidance[kind];
}
