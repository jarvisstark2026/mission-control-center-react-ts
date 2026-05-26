import { createId } from '../../lib/createId';
import type { CommandRisk, CommandScope, MissionControlEvent, MissionNotification } from '../mission-control';
import type { ShellRole } from '../shell/roles';

export type HomeSystemActionId =
  | 'use-solar-surplus'
  | 'pause-ev-charging'
  | 'charge-ev-from-surplus'
  | 'reduce-ac-load'
  | 'schedule-pool-pump'
  | 'close-windows'
  | 'arm-alarm'
  | 'run-home-diagnostics';

export type HomeSystemActionPlan = {
  id: HomeSystemActionId;
  title: string;
  summary: string;
  scope: CommandScope;
  risk: CommandRisk;
  agentId: string;
  agentName: string;
  profile: string;
  reasoning: string;
  expectedResult: string;
  roles: ShellRole[];
  sourceArea: 'energy' | 'vehicle' | 'climate' | 'automation' | 'security' | 'pool' | 'support';
};

export const homeSystemActionPlans: HomeSystemActionPlan[] = [
  {
    id: 'use-solar-surplus',
    title: 'Use solar surplus',
    summary: 'Route surplus Solar PV into battery-friendly loads before exporting to grid.',
    scope: 'household',
    risk: 'safe',
    agentId: 'jarvis-home',
    agentName: 'Home Agent',
    profile: 'home-energy',
    reasoning: 'Solar PV is above current home load, so flexible loads can be staged without touching security systems.',
    expectedResult: 'Battery, EV, pool, or appliance schedules use surplus energy after approval.',
    roles: ['admin', 'home'],
    sourceArea: 'energy',
  },
  {
    id: 'pause-ev-charging',
    title: 'Pause EV charging',
    summary: 'Pause the electric car charger until solar surplus or a cheaper tariff window returns.',
    scope: 'household',
    risk: 'safe',
    agentId: 'jarvis-home',
    agentName: 'Home Agent',
    profile: 'ev-energy',
    reasoning: 'EV charging is one of the largest flexible loads and can be safely paused when grid import rises.',
    expectedResult: 'EV charger moves to paused state and preserves the current vehicle schedule.',
    roles: ['admin', 'home'],
    sourceArea: 'vehicle',
  },
  {
    id: 'charge-ev-from-surplus',
    title: 'Charge EV from surplus',
    summary: 'Start or continue EV charging only while Solar PV surplus is available.',
    scope: 'household',
    risk: 'safe',
    agentId: 'jarvis-home',
    agentName: 'Home Agent',
    profile: 'ev-energy',
    reasoning: 'The home has usable PV surplus, and EV charging can absorb it without creating a high-risk command.',
    expectedResult: 'EV charging follows solar surplus and avoids unnecessary grid import.',
    roles: ['admin', 'home'],
    sourceArea: 'vehicle',
  },
  {
    id: 'reduce-ac-load',
    title: 'Reduce AC load',
    summary: 'Relax AC setpoints slightly to cut peak home demand.',
    scope: 'household',
    risk: 'safe',
    agentId: 'jarvis-home',
    agentName: 'Home Agent',
    profile: 'comfort-energy',
    reasoning: 'AC is a visible daily load and can usually be reduced with a small comfort-safe setpoint adjustment.',
    expectedResult: 'AC demand drops while comfort stays within the configured household band.',
    roles: ['admin', 'home'],
    sourceArea: 'climate',
  },
  {
    id: 'schedule-pool-pump',
    title: 'Schedule pool pump',
    summary: 'Move pool circulation into the Solar PV surplus window.',
    scope: 'household',
    risk: 'safe',
    agentId: 'jarvis-home',
    agentName: 'Home Agent',
    profile: 'pool-energy',
    reasoning: 'The pool pump is flexible and should run when PV production is high or tariffs are favorable.',
    expectedResult: 'Pool pump schedule is staged for the next surplus window after approval.',
    roles: ['admin', 'home'],
    sourceArea: 'pool',
  },
  {
    id: 'close-windows',
    title: 'Close automated windows',
    summary: 'Close rain/comfort-sensitive windows through the home automation bridge.',
    scope: 'household',
    risk: 'safe',
    agentId: 'jarvis-home',
    agentName: 'Home Agent',
    profile: 'home-automation',
    reasoning: 'Window actuators are degraded but still report enough state to stage a safe closure proposal.',
    expectedResult: 'Open automated windows close and the delayed actuator is flagged for follow-up.',
    roles: ['admin', 'home'],
    sourceArea: 'automation',
  },
  {
    id: 'arm-alarm',
    title: 'Arm home alarm',
    summary: 'Stage a perimeter alarm arm command for admin review.',
    scope: 'security',
    risk: 'critical',
    agentId: 'jarvis-security',
    agentName: 'Security Agent',
    profile: 'security-watch',
    reasoning: 'Alarm state changes are high-trust actions and must stay behind admin-level review.',
    expectedResult: 'Alarm arm request waits in Command Inbox and does not execute without admin approval.',
    roles: ['admin'],
    sourceArea: 'security',
  },
  {
    id: 'run-home-diagnostics',
    title: 'Run home diagnostics',
    summary: 'Collect non-invasive status from energy, security, camera, and tablet systems.',
    scope: 'support',
    risk: 'elevated',
    agentId: 'jarvis-support',
    agentName: 'Support Agent',
    profile: 'home-diagnostics',
    reasoning: 'Support can inspect degraded home systems without staging physical control actions.',
    expectedResult: 'A diagnostic report is queued through the command gateway with no direct device control.',
    roles: ['admin', 'support'],
    sourceArea: 'support',
  },
];

export function getHomeSystemActionPlansForRole(role: ShellRole) {
  if (role === 'guest') return [];
  return homeSystemActionPlans.filter((plan) => plan.roles.includes(role));
}

function createHomeActionNotification(commandId: string, plan: HomeSystemActionPlan, timestamp: string): MissionNotification {
  return {
    id: `notification-${commandId}-staged`,
    level: plan.risk === 'critical' ? 'critical' : plan.risk === 'elevated' ? 'warning' : 'notice',
    title: `Home proposal staged: ${plan.title}`,
    body: `${plan.agentName} sent "${plan.title}" to Command Inbox for human approval.`,
    source: 'home-systems',
    timestamp,
    acknowledged: false,
    relatedCommandId: commandId,
  };
}

export function createHomeSystemActionEvents(
  actionId: HomeSystemActionId,
  role: ShellRole,
  now = new Date(),
): MissionControlEvent[] {
  const plan = getHomeSystemActionPlansForRole(role).find((item) => item.id === actionId);
  if (!plan) return [];

  const timestamp = now.toISOString();
  const commandId = createId(`home-${actionId}`);

  return [
    {
      type: 'command',
      command: {
        id: commandId,
        title: plan.title,
        summary: plan.summary,
        source: `home-systems:${plan.sourceArea}`,
        agent: {
          agentId: plan.agentId,
          agentName: plan.agentName,
          profile: plan.profile,
        },
        reasoning: plan.reasoning,
        expectedResult: plan.expectedResult,
        scope: plan.scope,
        risk: plan.risk,
        status: 'pending',
        requestedAt: timestamp,
        execution: {
          status: 'not-started',
          result: 'Waiting in Command Inbox. Home Systems never executes device actions directly.',
          rollbackAvailable: plan.risk === 'safe',
        },
        auditTrail: [
          {
            id: `audit-${commandId}-proposed`,
            type: 'proposed',
            actor: 'home-systems',
            timestamp,
            detail: `${plan.agentName} staged "${plan.title}" from the Home Systems widget.`,
          },
        ],
      },
    },
    {
      type: 'notification',
      notification: createHomeActionNotification(commandId, plan, timestamp),
    },
  ];
}
