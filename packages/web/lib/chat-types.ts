export type ArtifactKind =
  | 'agent_output'
  | 'approval'
  | 'error'
  | 'attachment_note'
  | 'parsed_preview';

export interface ChatArtifact {
  id: string;
  kind: ArtifactKind;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: Array<{ id: string; name: string; url: string; mime?: string }>;
  artifacts?: ChatArtifact[];
}

export interface ChatSession {
  id: string;
  title: string;
  agentId: string;
  companyId: string;
  actorRole: string;
  actorId: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
