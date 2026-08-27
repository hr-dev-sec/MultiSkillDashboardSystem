/**
 * Multi-Skill Monitoring System Types
 * PT Ajinomoto Indonesia - Mojokerto Factory
 */

export interface SkillMeta {
  code: string;
  family: string;
  group: string;
}

export type JobPositionCategory = 'DEPT_MGR_UP' | 'ASM_SM' | 'LL_FOREMAN';

export interface Employee {
  rowIndex: number;
  no: number;
  empId: string;
  empName: string;
  divisi: string;
  department: string;
  section: string;
  grade: string;
  jobGrade: string;
  jabatan: string;
  gender: 'L' | 'P' | string;
  tanggalPensiun?: string;
  pic?: string;
  tahun: number;
  bulan: number;
  jobCategory: JobPositionCategory | null;
  totalScore: number;
  standard: number | null;
  result: 'MS' | 'US' | null;
  gap: number | null;
  skills: Record<string, boolean>;
}

export interface UserSession {
  username: string;
  name: string;
  role: string;
  department: string;
  email?: string;
  phone?: string;
  nik?: string;
  avatarUrl?: string;
  bio?: string;
  token?: string;
}

export interface UserAccount {
  username: string;
  password: string;
  name: string;
  role: string;
  department: string;
  email?: string;
  phone?: string;
  nik?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface PeriodsData {
  tahunList: number[];
  bulanByTahun: Record<string, number[]>;
  currentTahun: number;
  currentBulan: number;
  bulanLabels: string[];
}

export interface ConfigMeta {
  targetPercent: Record<JobPositionCategory, number>;
  jobPositionMeta: Record<JobPositionCategory, { label: string; threshold: number }>;
  bulanLabels: string[];
}

export interface AppFiltersState {
  tahun: string[];
  bulan: string[];
  divisi: string[];
  department: string[];
  jabatan: string[];
}

export interface PositionStat {
  key: JobPositionCategory;
  label: string;
  threshold: number;
  target: number;
  manpower: number;
  ok: number;
  notOk: number;
  resultPercent: number;
}

export interface GroupStat {
  label: string;
  ms: number;
  us: number;
}

export interface DashboardStats {
  totalManpower: number;
  totalMS: number;
  totalUS: number;
  percentMS: number;
  byPosition: PositionStat[];
  byDivisi: GroupStat[];
  byDepartment: GroupStat[];
  byGrade: GroupStat[];
  genderMap: { L: number; P: number; Lainnya: number };
  notes: string[];
  lastUpdated: string;
}
