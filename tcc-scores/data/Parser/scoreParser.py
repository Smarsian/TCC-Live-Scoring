import argparse
import json
import re
from pathlib import Path


TEAM_HEADER = "Teams:"
GAMES_HEADER = "Games:"
POINTS_HEADER = "Points:"
GAME_HEADER_PATTERN = re.compile(r"^Game\s+(\d+)\s*:\s*(.+)$", re.IGNORECASE)
SPECIAL_SCORING_HEADER_PATTERN = re.compile(r"^Triv(?:ia|a)\s+Segment:$", re.IGNORECASE)


def parse_numeric(value: str):
	value = value.strip()
	if not value:
		return 0
	try:
		return int(value)
	except ValueError:
		try:
			return float(value)
		except ValueError:
			return 0


def normalize_for_sort(name: str) -> str:
	return name.strip().lower()


def resolve_input_path(raw_argument: str, raw_data_dir: Path) -> Path:
	candidate = Path(raw_argument)
	if candidate.exists():
		return candidate.resolve()

	candidate_in_raw_data = raw_data_dir / raw_argument
	if candidate_in_raw_data.exists():
		return candidate_in_raw_data.resolve()

	raise FileNotFoundError(
		f"Could not find input file '{raw_argument}'. Expected an existing path or a file inside '{raw_data_dir}'."
	)


def parse_teams(lines):
	teams = {}
	player_to_team = {}
	current_team = None

	for line in lines:
		if not line:
			continue

		if line.endswith(":"):
			current_team = line[:-1].strip()
			teams[current_team] = []
			continue

		if current_team is None:
			continue

		player = line.strip()
		teams[current_team].append(player)
		player_to_team[player] = current_team

	return teams, player_to_team


def parse_games(lines):
	games = []
	current_game = None
	inside_points = False
	current_game_number = 0

	def finish_current_game():
		nonlocal current_game
		if current_game is not None:
			games.append(current_game)
			current_game = None

	for line in lines:
		if not line:
			continue

		game_match = GAME_HEADER_PATTERN.match(line)
		if game_match:
			finish_current_game()
			current_game_number += 1

			current_game = {
				"game-number": int(game_match.group(1)),
				"game-name": game_match.group(2).strip(),
				"special-scoring": False,
				"entries": [],
			}
			inside_points = False
			continue

		if SPECIAL_SCORING_HEADER_PATTERN.match(line):
			finish_current_game()
			current_game_number += 1

			current_game = {
				"game-number": current_game_number,
				"game-name": "Trivia",
				"special-scoring": True,
				"entries": [],
			}
			inside_points = False
			continue

		if line == POINTS_HEADER:
			inside_points = True
			continue

		if not inside_points or current_game is None:
			continue

		parts = re.split(r"\s+", line)
		if len(parts) < 3:
			continue

		placement = parse_numeric(parts[0])
		if current_game.get("special-scoring"):
			points = parse_numeric(parts[-1])
			team = " ".join(parts[1:-1]).strip()
			if team:
				current_game["entries"].append(
					{
						"place": placement,
						"team": team,
						"points": points,
					}
				)
			continue

		points = parse_numeric(parts[2])
		player = parts[1]
		current_game["entries"].append(
			{
				"place": placement,
				"player": player,
				"points": points,
			}
		)

	finish_current_game()

	return games


def rank_rows(rows, name_key):
	rows.sort(key=lambda row: (-row["points"], normalize_for_sort(row[name_key])))
	for index, row in enumerate(rows, start=1):
		row["place"] = index
	return rows


def build_output(event_name, teams, player_to_team, games):
	game_stats = []
	game_stats_by_name = {}
	all_players = [player for players in teams.values() for player in players]
	event_player_points = {
		player: {"team": player_to_team.get(player, "Unknown"), "points": 0}
		for player in all_players
	}
	event_team_points = {}

	for team_name in teams:
		event_team_points[team_name] = 0

	for game in games:
		game_player_points = {player: 0 for player in all_players}
		team_points = {team_name: 0 for team_name in teams}
		is_special_scoring = bool(game.get("special-scoring"))

		for entry in game["entries"]:
			points = entry["points"]
			if is_special_scoring:
				team = entry["team"]
				team_points.setdefault(team, 0)
				team_points[team] += points
				event_team_points.setdefault(team, 0)
				event_team_points[team] += points
				continue

			player = entry["player"]
			team = player_to_team.get(player, "Unknown")
			game_player_points.setdefault(player, 0)
			game_player_points[player] += points

			team_points.setdefault(team, 0)
			team_points[team] += points

			event_player_points.setdefault(player, {"team": team, "points": 0})
			event_player_points[player]["points"] += points

			event_team_points.setdefault(team, 0)
			event_team_points[team] += points

		player_rows = []
		if not is_special_scoring:
			player_rows = [
				{
					"player": player,
					"team": player_to_team.get(player, "Unknown"),
					"points": points,
				}
				for player, points in game_player_points.items()
			]
			player_rows = rank_rows(player_rows, "player")

		team_rows = [
			{
				"team": team_name,
				"points": points,
			}
			for team_name, points in team_points.items()
		]
		team_rows = rank_rows(team_rows, "team")

		game_stat_entry = {
			"game-number": game["game-number"],
			"game-name": game["game-name"],
			"special-scoring": is_special_scoring,
			"player-leaderboard": player_rows,
			"team-leaderboard": team_rows,
		}
		game_stats.append(game_stat_entry)
		game_stats_by_name.setdefault(game["game-name"], []).append(game_stat_entry)

	event_player_rows = [
		{
			"player": player,
			"team": data["team"],
			"points": data["points"],
		}
		for player, data in event_player_points.items()
	]
	event_player_rows = rank_rows(event_player_rows, "player")

	event_team_rows = [
		{
			"team": team_name,
			"points": points,
		}
		for team_name, points in event_team_points.items()
	]
	event_team_rows = rank_rows(event_team_rows, "team")

	return {
		"event-name": event_name,
		"teams": teams,
		"games": [game["game-name"] for game in games],
		"event-player-leaderboard": event_player_rows,
		"event-team-leaderboard": event_team_rows,
		"game-stats": game_stats,
		"game-stats-by-name": game_stats_by_name,
	}


def parse_raw_event_file(input_path: Path):
	lines = [line.strip() for line in input_path.read_text(encoding="utf-8").splitlines()]

	event_name = lines[0] if lines else input_path.stem

	try:
		teams_start = lines.index(TEAM_HEADER)
	except ValueError as error:
		raise ValueError(f"Input file '{input_path}' is missing the '{TEAM_HEADER}' section.") from error

	try:
		games_start = lines.index(GAMES_HEADER)
	except ValueError as error:
		raise ValueError(f"Input file '{input_path}' is missing the '{GAMES_HEADER}' section.") from error

	if games_start <= teams_start:
		raise ValueError("Invalid input order: 'Games:' must come after 'Teams:'.")

	teams_block = lines[teams_start + 1 : games_start]
	games_block = lines[games_start + 1 :]

	teams, player_to_team = parse_teams(teams_block)
	games = parse_games(games_block)

	if not teams:
		raise ValueError("No teams were parsed from the input file.")
	if not games:
		raise ValueError("No games were parsed from the input file.")

	return build_output(event_name, teams, player_to_team, games)


def main():
	parser = argparse.ArgumentParser(
		description="Parse a raw event TXT file into leaderboard-ready JSON output."
	)
	parser.add_argument(
		"input_file",
		help="Path or filename for a TXT file in data/Scoring/RawData.",
	)
	args = parser.parse_args()

	parser_dir = Path(__file__).resolve().parent
	scoring_dir = parser_dir.parent / "Scoring"
	raw_data_dir = scoring_dir / "RawData"
	output_dir = scoring_dir / "JSON-data"
	output_dir.mkdir(parents=True, exist_ok=True)

	input_path = resolve_input_path(args.input_file, raw_data_dir)
	parsed_payload = parse_raw_event_file(input_path)

	output_path = output_dir / f"{input_path.stem}.json"
	output_path.write_text(json.dumps(parsed_payload, indent=2), encoding="utf-8")

	print(f"Parsed '{input_path.name}' -> '{output_path}'")


if __name__ == "__main__":
	main()
