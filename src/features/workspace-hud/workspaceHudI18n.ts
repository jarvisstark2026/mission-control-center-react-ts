export type WorkspaceHudMessageKey =
  | 'hud.title'
  | 'hud.source'
  | 'hud.connection'
  | 'hud.role'
  | 'hud.mode'
  | 'hud.agent'
  | 'hud.voice'
  | 'hud.telemetry'
  | 'hud.noTelemetry'
  | 'hud.metrics'
  | 'hud.design'
  | 'hud.color'
  | 'hud.voiceReaction'
  | 'hud.audioMeter'
  | 'hud.voiceTest'
  | 'hud.agentControl'
  | 'hud.on'
  | 'hud.off'
  | 'hud.enabled'
  | 'hud.disabled'
  | 'hud.localMock'
  | 'hud.reducedMotion'
  | 'hud.metric.commands'
  | 'hud.metric.notifications'
  | 'hud.metric.integrations'
  | 'hud.metric.workspaces';

type WorkspaceHudDictionary = Record<WorkspaceHudMessageKey, string>;

const dictionaries: Record<'en' | 'pt', WorkspaceHudDictionary> = {
  en: {
    'hud.title': 'Main workspace HUD',
    'hud.source': 'Source',
    'hud.connection': 'Connection',
    'hud.role': 'Access',
    'hud.mode': 'Mode',
    'hud.agent': 'Agent',
    'hud.voice': 'Voice',
    'hud.telemetry': 'Telemetry',
    'hud.noTelemetry': 'No telemetry samples',
    'hud.metrics': 'Operational state',
    'hud.design': 'HUD design',
    'hud.color': 'Color controller',
    'hud.voiceReaction': 'Voice reaction',
    'hud.audioMeter': 'Live audio meter',
    'hud.voiceTest': 'Test pulse',
    'hud.agentControl': 'Open Agent Control',
    'hud.on': 'On',
    'hud.off': 'Off',
    'hud.enabled': 'enabled',
    'hud.disabled': 'disabled',
    'hud.localMock': 'local/mock',
    'hud.reducedMotion': 'Reduced motion active',
    'hud.metric.commands': 'Pending commands',
    'hud.metric.notifications': 'Alerts',
    'hud.metric.integrations': 'Integrations',
    'hud.metric.workspaces': 'ON workspaces',
  },
  pt: {
    'hud.title': 'HUD da area principal',
    'hud.source': 'Fonte',
    'hud.connection': 'Ligacao',
    'hud.role': 'Acesso',
    'hud.mode': 'Modo',
    'hud.agent': 'Agente',
    'hud.voice': 'Voz',
    'hud.telemetry': 'Telemetria',
    'hud.noTelemetry': 'Sem amostras de telemetria',
    'hud.metrics': 'Estado operacional',
    'hud.design': 'Desenho do HUD',
    'hud.color': 'Controlador de cor',
    'hud.voiceReaction': 'Reacao a voz',
    'hud.audioMeter': 'Medidor audio ao vivo',
    'hud.voiceTest': 'Pulso de teste',
    'hud.agentControl': 'Abrir Agent Control',
    'hud.on': 'Ligado',
    'hud.off': 'Desligado',
    'hud.enabled': 'ativo',
    'hud.disabled': 'inativo',
    'hud.localMock': 'local/mock',
    'hud.reducedMotion': 'Movimento reduzido ativo',
    'hud.metric.commands': 'Comandos pendentes',
    'hud.metric.notifications': 'Alertas',
    'hud.metric.integrations': 'Integracoes',
    'hud.metric.workspaces': 'Areas ligadas',
  },
};

function getLocaleFamily(locale: string) {
  return locale.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function getWorkspaceHudLocale(locale = typeof navigator === 'undefined' ? 'en' : navigator.language) {
  return getLocaleFamily(locale);
}

export function getWorkspaceHudMessage(key: WorkspaceHudMessageKey, locale?: string) {
  return dictionaries[getWorkspaceHudLocale(locale)][key] ?? dictionaries.en[key];
}

export function createWorkspaceHudNumberFormatter(locale?: string) {
  return new Intl.NumberFormat(locale ?? (typeof navigator === 'undefined' ? 'en' : navigator.language));
}
