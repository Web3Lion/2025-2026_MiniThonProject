import { NextRequest, NextResponse } from "next/server";
import { generateStudentWallets, walletsToCSV, parseStudentCSV } from "@/lib/walletGenerator";
import { readStore, writeStore } from "@/lib/store";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    // ── Generate wallets + optionally assign to teams ─────────────────────────
    case "generate": {
      const { csvContent, credentials, initialHbar, teamAssignments } = body;
      // teamAssignments: { [studentName]: teamId | "new:TeamName" } — from UI overrides

      if (!csvContent?.trim())
        return NextResponse.json({ error: "CSV content required" }, { status: 400 });
      if (!credentials?.payerAccountId || !credentials?.payerPrivateKey)
        return NextResponse.json({ error: "Payer credentials required" }, { status: 400 });

      const students = parseStudentCSV(csvContent);
      if (!students.length)
        return NextResponse.json({ error: "No student names found" }, { status: 400 });

      const hbarAmount = Math.max(0, parseFloat(initialHbar) || 1);
      console.log(`[Wallets] Generating ${students.length} wallets, ${hbarAmount} HBAR each`);

      const result = await generateStudentWallets(students, {
        payerAccountId: credentials.payerAccountId,
        payerPrivateKey: credentials.payerPrivateKey,
        network: credentials.network ?? "testnet",
        initialHbar: hbarAmount,
      });

      // Auto-assign to teams based on CSV team column + UI overrides
      if (result.wallets.length > 0) {
        const store = readStore();
        const now = new Date().toISOString();

        // Build a map of team name → team ID (creating new teams as needed)
        const teamNameToId: Record<string, string> = {};
        for (const t of store.teams) {
          teamNameToId[t.name.toLowerCase()] = t.id;
        }

        for (let i = 0; i < result.wallets.length; i++) {
          const wallet  = result.wallets[i];
          const student = students[i];

          // Determine team: UI override > CSV column > unassigned
          let teamId: string | null = null;
          const override = teamAssignments?.[wallet.studentName];

          if (override?.startsWith("new:")) {
            // Create a brand new team
            const newTeamName = override.slice(4).trim();
            if (!teamNameToId[newTeamName.toLowerCase()]) {
              const newTeam = {
                id: uuidv4(), name: newTeamName, members: [],
                donationTotal: 0, currentTier: 1 as const,
                donationLog: [], createdAt: now, updatedAt: now,
              };
              store.teams.push(newTeam);
              teamNameToId[newTeamName.toLowerCase()] = newTeam.id;
            }
            teamId = teamNameToId[newTeamName.toLowerCase()];
          } else if (override && override !== "unassigned") {
            teamId = override;
          } else if (student.teamName) {
            const key = student.teamName.toLowerCase();
            if (!teamNameToId[key]) {
              // Auto-create team from CSV
              const newTeam = {
                id: uuidv4(), name: student.teamName, members: [],
                donationTotal: 0, currentTier: 1 as const,
                donationLog: [], createdAt: now, updatedAt: now,
              };
              store.teams.push(newTeam);
              teamNameToId[key] = newTeam.id;
            }
            teamId = teamNameToId[key];
          }

          if (teamId) {
            const team = store.teams.find(t => t.id === teamId);
            if (team) {
              team.members.push({
                id: uuidv4(),
                name: wallet.studentName,
                walletAddress: wallet.accountId,
              });
              team.updatedAt = now;
            }
          }
        }

        writeStore(store);
      }

      return NextResponse.json({
        success:        true,
        wallets:        result.wallets,
        failed:         result.failed,
        csv:            walletsToCSV(result.wallets),
        count:          result.wallets.length,
        totalHbarSpent: hbarAmount * result.wallets.length,
      });
    }

    // ── Get existing teams for the assignment UI ───────────────────────────────
    case "get_teams": {
      const store = readStore();
      return NextResponse.json({
        teams: store.teams.map(t => ({ id: t.id, name: t.name, memberCount: t.members.length })),
      });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}