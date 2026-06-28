import argparse
import json
import re
from pathlib import Path


TEAM_HEADER = "Teams:"
GAMES_HEADER = "Games:"
POINTS_HEADER = "Points:"
GAME_HEADER_PATTERN = re.compile(r"^Game\s+(\d+)\s*:\s*(.+)$", re.IGNORECASE)
SPECIAL_SCORING_HEADER_PATTERN = re.compile(r"^Triv(?:ia|a)\s+Segment:$", re.IGNORECASE)
NUMERIC_TOKEN_PATTERN = re.compile(r"^[+-]?\d+(?:\.\d+)?$")


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


def is_numeric_token(value: str) -> bool:
	return bool(NUMERIC_TOKEN_PATTERN.match(value.strip()))


def normalize_for_sort(name: str) -> str:
	return name.strip().lower()


def build_player_to_team(teams):
	player_to_team = {}
	for team_name, players in teams.items():
		for player in players:
			player_to_team[player] = team_name
	return player_to_team


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
		if len(parts) < 2:
			continue

		has_leading_placement = is_numeric_token(parts[0])
		placement = parse_numeric(parts[0]) if has_leading_placement else 0
		content_start = 1 if has_leading_placement else 0

		if current_game.get("special-scoring"):
			if len(parts) - content_start < 2:
				continue

			points = parse_numeric(parts[-1])
			team = " ".join(parts[content_start:-1]).strip()
			if team:
				current_game["entries"].append(
					{
						"place": placement,
						"team": team,
						"points": points,
					}
				)
			continue

		if len(parts) - content_start < 2:
			continue

		player = parts[content_start]
		points = parse_numeric(parts[-1])
		current_game["entries"].append(
			{
				"place": placement,
				"player": player,
				"points": points,
			}
		)

	finish_current_game()

	return games


def load_existing_teams(output_path: Path):
	if not output_path.exists():
		return None

	try:
		payload = json.loads(output_path.read_text(encoding="utf-8"))
	except (OSError, json.JSONDecodeError):
		return None

	teams = payload.get("teams")
	if not isinstance(teams, dict):
		return None

	normalized_teams = {}
	for team_name, players in teams.items():
		if not isinstance(team_name, str) or not isinstance(players, list):
			return None
		if not all(isinstance(player, str) for player in players):
			return None
		normalized_teams[team_name] = players

	return normalized_teams


def build_substitution_map(raw_teams, existing_teams):
	if not existing_teams:
		return {}

	substitutions = {}
	for team_name, raw_players in raw_teams.items():
		existing_players = existing_teams.get(team_name)
		if not isinstance(existing_players, list):
			continue

		missing_from_existing = [player for player in raw_players if player not in existing_players]
		added_in_existing = [player for player in existing_players if player not in raw_players]

		if len(missing_from_existing) != len(added_in_existing):
			continue

		for old_player, new_player in zip(missing_from_existing, added_in_existing):
			substitutions[old_player] = new_player

	return substitutions


def apply_player_substitutions_to_games(games, substitution_map):
	if not substitution_map:
		return games

	for game in games:
		if game.get("special-scoring"):
			continue
		for entry in game.get("entries", []):
			player = entry.get("player")
			if player in substitution_map:
				entry["player"] = substitution_map[player]

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

	event_name = input_path.stem
	body_lines = lines
	if lines:
		first_line = lines[0]
		if (
			first_line not in {TEAM_HEADER, GAMES_HEADER, POINTS_HEADER}
			and not GAME_HEADER_PATTERN.match(first_line)
			and not SPECIAL_SCORING_HEADER_PATTERN.match(first_line)
		):
			event_name = first_line
			body_lines = lines[1:]

	teams_start = body_lines.index(TEAM_HEADER) if TEAM_HEADER in body_lines else None
	games_start = body_lines.index(GAMES_HEADER) if GAMES_HEADER in body_lines else None

	teams_block = []
	games_block = []

	if teams_start is not None:
		teams_end = games_start if games_start is not None and games_start > teams_start else len(body_lines)
		if games_start is None:
			for index in range(teams_start + 1, len(body_lines)):
				line = body_lines[index]
				if GAME_HEADER_PATTERN.match(line) or SPECIAL_SCORING_HEADER_PATTERN.match(line):
					teams_end = index
					games_block = body_lines[index:]
					break
		teams_block = body_lines[teams_start + 1 : teams_end]

	if games_start is not None:
		games_block = body_lines[games_start + 1 :]
	elif teams_start is None:
		# With no explicit headers, treat the body as game data and parse whatever matches.
		games_block = body_lines

	teams, player_to_team = parse_teams(teams_block)
	games = parse_games(games_block)

	return event_name, teams, player_to_team, games


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
	output_path = output_dir / f"{input_path.stem}.json"

	event_name, teams, player_to_team, games = parse_raw_event_file(input_path)
	existing_teams = load_existing_teams(output_path)
	substitution_map = build_substitution_map(teams, existing_teams)

	if existing_teams:
		teams = existing_teams
		player_to_team = build_player_to_team(teams)

	games = apply_player_substitutions_to_games(games, substitution_map)
	parsed_payload = build_output(event_name, teams, player_to_team, games)
	output_path.write_text(json.dumps(parsed_payload, indent=2), encoding="utf-8")

	substitution_count = len(substitution_map)
	print(
		f"Parsed '{input_path.name}' -> '{output_path}'"
		f" (preserved substitutions: {substitution_count})"
	)


if __name__ == "__main__":
	main()
