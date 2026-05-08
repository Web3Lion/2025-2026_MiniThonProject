import { NextRequest, NextResponse } from "next/server";
import {
  createTeam,
  getAllTeams,
  deleteTeam,
  addTeamMember,
  updateMemberWallet,
} from "@/lib/store";
import { isValidHederaAccountId } from "@/lib/hedera";

export async function GET() {
  const teams = getAllTeams();
  return NextResponse.json({ teams });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "create_team": {
      const { name } = body;
      if (!name?.trim()) {
        return NextResponse.json({ error: "Team name required" }, { status: 400 });
      }
      const team = createTeam(name.trim());
      return NextResponse.json({ team });
    }

    case "delete_team": {
      const { teamId } = body;
      const ok = deleteTeam(teamId);
      return NextResponse.json({ success: ok });
    }

    case "add_member": {
      const { teamId, memberName, walletAddress } = body;
      if (!teamId || !memberName?.trim()) {
        return NextResponse.json(
          { error: "Team ID and member name required" },
          { status: 400 }
        );
      }
      if (walletAddress && !isValidHederaAccountId(walletAddress)) {
        return NextResponse.json(
          { error: "Invalid Hedera account ID format (expected 0.0.XXXXX)" },
          { status: 400 }
        );
      }
      const member = addTeamMember(teamId, memberName.trim(), walletAddress);
      if (!member) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
      return NextResponse.json({ member });
    }

    case "update_wallet": {
      const { teamId, memberId, walletAddress } = body;
      if (!isValidHederaAccountId(walletAddress)) {
        return NextResponse.json(
          { error: "Invalid Hedera account ID" },
          { status: 400 }
        );
      }
      const ok = updateMemberWallet(teamId, memberId, walletAddress);
      return NextResponse.json({ success: ok });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
