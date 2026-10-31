import { supabase } from "@/integrations/supabase/client";
import { replayMatch, oversText, type InningsEvent, type MatchSetup, type Team } from "./engine";

export async function saveTeam(team: Team) {
  const { error } = await supabase.from("teams").upsert({ id: team.id, name: team.name, color: team.color });
  if (error) throw error;
  const ids = team.players.map((p) => p.id);
  let del = supabase.from("players").delete().eq("team_id", team.id);
  if (ids.length) del = del.not("id", "in", `(${ids.join(",")})`);
  await del;
  if (team.players.length) {
    const { error: pe } = await supabase
      .from("players")
      .upsert(team.players.map((p) => ({ id: p.id, name: p.name, team_id: team.id })));
    if (pe) throw pe;
  }
}

export async function loadTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id,name,color,players(id,name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color, players: t.players ?? [] }));
}

export async function saveMatch(setup: MatchSetup, events: [InningsEvent[], InningsEvent[]]) {
  await Promise.all([saveTeam(setup.team1), saveTeam(setup.team2)]);
  const m = replayMatch(setup, events);
  const toss = setup.tossWinner === 0 ? setup.team1 : setup.team2;
  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      team1_id: setup.team1.id,
      team2_id: setup.team2.id,
      overs: setup.overs,
      toss_winner_id: toss.id,
      toss_decision: setup.decision,
      winner_id: m.result?.winnerTeam?.id ?? null,
      status: "completed",
      result_text: m.result?.text ?? null,
      summary: JSON.parse(JSON.stringify({ setup, events })),
    })
    .select("id")
    .single();
  if (error) throw error;

  for (const idx of [0, 1] as const) {
    const inn = m.innings[idx];
    if (!inn) continue;
    const { data: row, error: ie } = await supabase
      .from("innings")
      .insert({
        match_id: match.id,
        inning_number: idx + 1,
        batting_team_id: inn.battingTeam.id,
        bowling_team_id: inn.bowlingTeam.id,
        total_runs: inn.runs,
        total_wickets: inn.wickets,
        total_overs_bowled: oversText(inn.legalBalls),
      })
      .select("id")
      .single();
    if (ie) throw ie;
    // ball rows: replay to know striker/bowler at each ball
    const balls: Array<Record<string, unknown>> = [];
    let striker: string | null = null,
      non: string | null = null,
      bowler: string | null = null,
      legal = 0,
      inOver = 0;
    for (const e of events[idx]) {
      if (e.k === "openers") [striker, non] = [e.striker, e.nonStriker];
      else if (e.k === "bowler") bowler = e.id;
      else if (e.k === "newBatter") {
        if (!striker) striker = e.id;
        else non = e.id;
      } else if (e.k === "ball") {
        inOver++;
        balls.push({
          match_id: match.id,
          inning_id: row.id,
          over_number: Math.floor(legal / 6) + 1,
          ball_number: inOver,
          bowler_id: bowler,
          striker_id: striker,
          non_striker_id: non,
          runs_scored: e.extra === "wd" ? 0 : e.runs,
          extra_type: e.extra,
          extra_runs: e.extra === "wd" ? 1 + e.runs : e.extra === "nb" ? 1 : 0,
          is_wicket: !!e.wicket,
          wicket_type: e.wicket?.type ?? null,
        });
        const isLegal = !e.extra && e.wicket?.type !== "retired_out";
        if (e.runs % 2 === 1) [striker, non] = [non, striker];
        if (e.wicket) {
          if (striker === e.wicket.outId) striker = null;
          else if (non === e.wicket.outId) non = null;
          if (!striker && non) [striker, non] = [non, null];
        }
        if (isLegal) {
          legal++;
          if (legal % 6 === 0) {
            if (non) [striker, non] = [non, striker];
            inOver = 0;
          }
        }
      }
    }
    if (balls.length) {
      const { error: be } = await supabase.from("ball_by_ball").insert(balls as never);
      if (be) throw be;
    }
  }
  return match.id;
}

export type HistoryRow = { id: string; created_at: string; result_text: string | null; overs: number; summary: unknown };

export async function loadHistory(): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("id,created_at,result_text,overs,summary")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadMatch(id: string) {
  const { data, error } = await supabase.from("matches").select("id,created_at,result_text,summary").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
