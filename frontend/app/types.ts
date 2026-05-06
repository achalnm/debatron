export interface DebaterConfig {
  name: string;
  persona: string;
  stance: string;
}

export interface DebateConfig {
  topic: string;
  debaters: DebaterConfig[];
}
