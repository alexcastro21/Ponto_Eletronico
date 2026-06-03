/**
 * SmartPoint Web - TypeScript Types Definition
 */

export interface Company {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string;
  status: 'ativo' | 'inativo';
}

export interface Scale {
  id: string;
  nome: string;
  cargaHoraria: string;
  entrada: string; // e.g. "08:00"
  almocoSaida: string; // e.g. "12:00"
  almocoRetorno: string; // e.g. "13:00"
  saida: string; // e.g. "17:00"
  tolerancia: number; // in minutes
}

export interface Employee {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  setor: string;
  empresaId?: string; // Multi-company relation
  escalaId?: string; // Workplace shift hours relation
  entrada: string; // e.g. "08:00"
  almocoSaida: string; // e.g. "12:00"
  almocoRetorno: string; // e.g. "13:00"
  saida: string; // e.g. "17:00"
  fotoUrl: string; // Base64 registered facial profile
  status: 'ativo' | 'inativo';
  createdAt: string;
  assinaturaDigital?: string; // ICP-Brasil electronic key / digital signature certificate
}

export type TimeLogType = 'entrada' | 'almoco_saida' | 'almoco_retorno' | 'saida_final';

export interface TimeLog {
  id: string;
  cpf: string;
  nome: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  tipo: TimeLogType;
  status: 'no_prazo' | 'atrasado' | 'adiantado';
  fotoUrl: string; // Frame captured at verification
  confidence: number;
  matched: boolean;
  empresaId?: string; // Company log link
  ip?: string; // Clock-in device IP
  liveness?: string; // Verification tag
  gps?: string; // Location metrics
  hash?: string; // Cryptographic SHA-256 signature
}

export interface SystemConfig {
  toleranciaMinutos: number;
  empresaNome: string;
  timezone: string;
  sheetsId: string;
  sheetsEnabled: boolean;
}

export interface AjusteRequest {
  id: string;
  pontoId?: string;
  cpf: string;
  nome: string;
  data: string;
  horaNova: string;
  tipo: TimeLogType;
  justificativa: string;
  status: 'pendente' | 'aprovado' | 'reprovado';
  dataSolicitacao: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  usuario: string;
  acao: string;
  detalhes: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
}

export interface DatabaseState {
  companies: Company[];
  escalas: Scale[];
  employees: Employee[];
  logs: TimeLog[];
  config: SystemConfig;
  ajustes: AjusteRequest[];
  systemLogs: SystemLog[];
}
