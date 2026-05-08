import { Team, AdminState, DonationEntry, TeamMember, TierLevel, LayerDefinition } from "@/types";
import { DEFAULT_TIERS, getTierForDonation } from "./tierConfig";
import { DEFAULT_LAYERS } from "./tierConfig";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "store.json");

const DEFAULT_STATE: AdminState = {
  teams: [], tiers: DEFAULT_TIERS, traitPool: [],
  layers: DEFAULT_LAYERS,
  tokenId: null, collectionName: "Minthon 2025 — Cure Kids Cancer",
  totalDonations: 0, lastUpdated: new Date().toISOString(),
};

export function readStore(): AdminState {
  try {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_PATH)) { fs.writeFileSync(DATA_PATH, JSON.stringify(DEFAULT_STATE, null, 2)); return DEFAULT_STATE; }
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AdminState;
    if (!parsed.layers) parsed.layers = DEFAULT_LAYERS;
    return parsed;
  } catch { return { ...DEFAULT_STATE }; }
}

export function writeStore(state: AdminState): void {
  try {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    state.lastUpdated = new Date().toISOString();
    state.totalDonations = state.teams.reduce((s, t) => s + t.donationTotal, 0);
    fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2));
  } catch (err) { console.error("Failed to write store:", err); }
}

export function createTeam(name: string): Team {
  const store = readStore();
  const team: Team = { id: uuidv4(), name, members: [], donationTotal: 0, currentTier: 1, donationLog: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  store.teams.push(team); writeStore(store); return team;
}

export function deleteTeam(teamId: string): boolean {
  const store = readStore(); const before = store.teams.length;
  store.teams = store.teams.filter(t => t.id !== teamId); writeStore(store);
  return store.teams.length < before;
}

export function addTeamMember(teamId: string, name: string, walletAddress?: string): TeamMember | null {
  const store = readStore(); const team = store.teams.find(t => t.id === teamId); if (!team) return null;
  const member: TeamMember = { id: uuidv4(), name, walletAddress };
  team.members.push(member); team.updatedAt = new Date().toISOString(); writeStore(store); return member;
}

export function updateMemberWallet(teamId: string, memberId: string, walletAddress: string): boolean {
  const store = readStore(); const team = store.teams.find(t => t.id === teamId); if (!team) return false;
  const member = team.members.find(m => m.id === memberId); if (!member) return false;
  member.walletAddress = walletAddress; team.updatedAt = new Date().toISOString(); writeStore(store); return true;
}

export function recordDonation(teamId: string, amountCents: number, donor?: string, note?: string): DonationEntry | null {
  const store = readStore(); const team = store.teams.find(t => t.id === teamId); if (!team) return null;
  const entry: DonationEntry = { id: uuidv4(), amount: amountCents, donor, note, recordedAt: new Date().toISOString(), recordedBy: "admin" };
  team.donationLog.push(entry); team.donationTotal += amountCents;
  team.currentTier = getTierForDonation(team.donationTotal, store.tiers).level as TierLevel;
  team.updatedAt = new Date().toISOString(); writeStore(store); return entry;
}

export function removeDonation(teamId: string, entryId: string): boolean {
  const store = readStore(); const team = store.teams.find(t => t.id === teamId); if (!team) return false;
  const entry = team.donationLog.find(e => e.id === entryId); if (!entry) return false;
  team.donationLog = team.donationLog.filter(e => e.id !== entryId);
  team.donationTotal = Math.max(0, team.donationTotal - entry.amount);
  team.currentTier = getTierForDonation(team.donationTotal, store.tiers).level as TierLevel;
  team.updatedAt = new Date().toISOString(); writeStore(store); return true;
}

export function setTokenId(tokenId: string): void { const store = readStore(); store.tokenId = tokenId; writeStore(store); }
export function getTeam(teamId: string): Team | null { return readStore().teams.find(t => t.id === teamId) ?? null; }
export function getTeamByMemberWallet(wa: string): Team | null { return readStore().teams.find(t => t.members.some(m => m.walletAddress === wa)) ?? null; }
export function getAllTeams(): Team[] { return readStore().teams; }
export function getLeaderboard(): Team[] { return [...readStore().teams].sort((a, b) => b.donationTotal - a.donationTotal); }
