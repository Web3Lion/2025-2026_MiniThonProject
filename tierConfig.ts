import { NextRequest, NextResponse } from "next/server";
import { recordDonation, removeDonation, getLeaderboard } from "@/lib/store";

export async function GET() {
  const leaderboard = getLeaderboard();
  return NextResponse.json({ leaderboard });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "record": {
      const { teamId, amount, donor, note } = body;
      if (!teamId || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return NextResponse.json(
          { error: "Valid teamId and positive amount (in dollars) required" },
          { status: 400 }
        );
      }
      // Convert dollars to cents
      const amountCents = Math.round(Number(amount) * 100);
      const entry = recordDonation(teamId, amountCents, donor, note);
      if (!entry) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
      return NextResponse.json({ entry, amountCents });
    }

    case "remove": {
      const { teamId, entryId } = body;
      if (!teamId || !entryId) {
        return NextResponse.json(
          { error: "teamId and entryId required" },
          { status: 400 }
        );
      }
      const ok = removeDonation(teamId, entryId);
      return NextResponse.json({ success: ok });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
