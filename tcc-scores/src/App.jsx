import { useEffect, useMemo, useState } from 'react'
import events from '../data/events.json'
import games from '../data/games.json'
import teams from '../data/teams.json'
import './App.css'

const normalizeTeamName = (name) => name.toLowerCase().replaceAll('_', ' ').trim()

const normalizeGameName = (name) => name.toLowerCase().replaceAll('_', ' ').trim()

const toLabel = (name) => name.replaceAll('_', ' ')

const getFirstGameNameForEvent = (eventData) => eventData?.['game-order']?.[0] ?? ''
const defaultGameMultipliers = [1, 1.5, 2, 2.5, 3]

const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const normalized = value.replaceAll(',', '').replaceAll('+', '').trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const formatMultiplier = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number') {
    return `${value}x`
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/x$/i, '')
    const parsed = toNumber(normalized)
    return parsed !== null ? `${parsed}x` : value
  }

  return String(value)
}

const sortLeaderboardEntries = (entries) => {
  return [...entries].sort((left, right) => {
    const leftPlace = toNumber(left.place)
    const rightPlace = toNumber(right.place)

    if (leftPlace !== null || rightPlace !== null) {
      return (leftPlace ?? Number.POSITIVE_INFINITY) - (rightPlace ?? Number.POSITIVE_INFINITY)
    }

    const leftPoints = toNumber(left.points) ?? toNumber(left.coins)
    const rightPoints = toNumber(right.points) ?? toNumber(right.coins)

    if (leftPoints !== null || rightPoints !== null) {
      return (rightPoints ?? Number.NEGATIVE_INFINITY) - (leftPoints ?? Number.NEGATIVE_INFINITY)
    }

    return String(left.name ?? left.player ?? left.team ?? '').localeCompare(
      String(right.name ?? right.player ?? right.team ?? ''),
    )
  })
}

const getSeasonNumber = (seasonName) => {
  const match = seasonName.match(/\d+/)
  return match ? Number(match[0]) : 0
}

const getMostRecentEventNameForSeason = (seasonEvents) => {
  const candidates = Object.entries(seasonEvents ?? {}).map(([eventName, eventData], index) => {
    const parsedDate = Date.parse(eventData?.date ?? '')

    return {
      eventName,
      dateValue: Number.isNaN(parsedDate) ? Number.NEGATIVE_INFINITY : parsedDate,
      eventNumber: Number(eventData?.['event-num']) || 0,
      index,
    }
  })

  if (candidates.length === 0) {
    return ''
  }

  candidates.sort(
    (left, right) =>
      right.dateValue - left.dateValue ||
      right.eventNumber - left.eventNumber ||
      right.index - left.index,
  )

  return candidates[0].eventName
}

const getMostRecentEventSelection = (allEvents) => {
  const candidates = []

  Object.entries(allEvents).forEach(([seasonName, seasonEvents], seasonIndex) => {
    Object.entries(seasonEvents ?? {}).forEach(([eventName, eventData], eventIndex) => {
      const parsedDate = Date.parse(eventData?.date ?? '')

      candidates.push({
        seasonName,
        eventName,
        dateValue: Number.isNaN(parsedDate) ? Number.NEGATIVE_INFINITY : parsedDate,
        seasonNumber: getSeasonNumber(seasonName),
        eventNumber: Number(eventData?.['event-num']) || 0,
        seasonIndex,
        eventIndex,
      })
    })
  })

  if (candidates.length === 0) {
    return {
      seasonName: '',
      eventName: '',
    }
  }

  candidates.sort(
    (left, right) =>
      right.dateValue - left.dateValue ||
      right.seasonNumber - left.seasonNumber ||
      right.eventNumber - left.eventNumber ||
      right.seasonIndex - left.seasonIndex ||
      right.eventIndex - left.eventIndex,
  )

  return {
    seasonName: candidates[0].seasonName,
    eventName: candidates[0].eventName,
  }
}

const imageModules = import.meta.glob('../images/**/*.{png,jpg,jpeg,svg,webp}', {
  eager: true,
  import: 'default',
})

const resolveLogoUrl = (logoFileName) => {
  if (!logoFileName) {
    return null
  }

  const normalizedFileName = logoFileName.toLowerCase()

  for (const [imagePath, imageUrl] of Object.entries(imageModules)) {
    if (imagePath.toLowerCase().endsWith(`/${normalizedFileName}`)) {
      return imageUrl
    }
  }

  return null
}

function App() {
  const getInitialTheme = () => {
    const storedTheme = localStorage.getItem('theme')

    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const initialSelection = useMemo(() => getMostRecentEventSelection(events), [])
  const [theme, setTheme] = useState(getInitialTheme)
  const seasons = useMemo(() => Object.keys(events), [])
  const initialSeason = initialSelection.seasonName || seasons[0] || ''
  const [selectedSeason, setSelectedSeason] = useState(initialSeason)

  const eventNames = useMemo(() => {
    if (!selectedSeason || !events[selectedSeason]) {
      return []
    }

    return Object.keys(events[selectedSeason])
  }, [selectedSeason])

  const [selectedEvent, setSelectedEvent] = useState(
    initialSelection.eventName || getMostRecentEventNameForSeason(events[initialSeason]),
  )
  const [selectedGameIndex, setSelectedGameIndex] = useState(0)
  const [leaderboardView, setLeaderboardView] = useState('game')

  const eventData = useMemo(() => {
    if (!selectedSeason || !selectedEvent) {
      return null
    }

    return events[selectedSeason]?.[selectedEvent] ?? null
  }, [selectedSeason, selectedEvent])

  const handleSeasonChange = (event) => {
    const nextSeason = event.target.value
    const nextEventName = Object.keys(events[nextSeason] ?? {})[0] ?? ''
    const nextEventData = events[nextSeason]?.[nextEventName]

    setSelectedSeason(nextSeason)
    setSelectedEvent(nextEventName)
    setSelectedGameIndex(getFirstGameNameForEvent(nextEventData) ? 0 : -1)
  }

  const handleEventChange = (event) => {
    const nextEventName = event.target.value
    const nextEventData = events[selectedSeason]?.[nextEventName]

    setSelectedEvent(nextEventName)
    setSelectedGameIndex(getFirstGameNameForEvent(nextEventData) ? 0 : -1)
  }

  const winners = eventData
    ? [eventData.winner, eventData['winner-2']].filter(Boolean)
    : []

  const runnerUps = eventData
    ? [eventData['runner-up'] ?? eventData['runner-ups'], eventData['runner-up-2']].filter(
        Boolean,
      )
    : []

  const gameOrder = eventData?.['game-order'] ?? []
  const isLiveEvent = Boolean(eventData?.['is-live'])

  const gameLookup = useMemo(() => {
    return Object.entries(games).reduce((lookup, [gameName, gameData]) => {
      const gameEntry = {
        name: gameName,
        abbreviation: gameData.abbreviation,
        logoUrl: resolveLogoUrl(gameData.image),
      }

      lookup[normalizeGameName(gameName)] = gameEntry

      if (gameData.abbreviation) {
        lookup[normalizeGameName(gameData.abbreviation)] = gameEntry
      }

      return lookup
    }, {})
  }, [])

  const teamLookup = useMemo(() => {
    return Object.entries(teams).reduce((lookup, [teamName, teamData]) => {
      lookup[normalizeTeamName(teamName)] = {
        name: toLabel(teamName),
        color: teamData.color,
        logoUrl: resolveLogoUrl(teamData.logo),
      }
      return lookup
    }, {})
  }, [])

  const mapTeamsWithAssets = (teamNames) => {
    return teamNames.map((teamName) => {
      const formattedName = toLabel(teamName)
      const match = teamLookup[normalizeTeamName(teamName)]

      return {
        name: formattedName,
        color: match?.color,
        logoUrl: match?.logoUrl ?? null,
      }
    })
  }

  const winnerTeams = mapTeamsWithAssets(winners)
  const runnerUpTeams = mapTeamsWithAssets(runnerUps)

  const gameOrderWithAssets = gameOrder.map((gameName) => {
    const match = gameLookup[normalizeGameName(gameName)]

    return {
      rawName: gameName,
      name: match?.name ?? toLabel(gameName),
      abbreviation: match?.abbreviation ?? null,
      logoUrl: match?.logoUrl ?? null,
    }
  })

  const selectedGame =
    gameOrderWithAssets[selectedGameIndex] ??
    gameOrderWithAssets[0] ?? {
      rawName: '',
      name: '',
      abbreviation: null,
      logoUrl: null,
    }

  const gameStatsLookup = eventData?.['game-stats'] ?? {}
  const selectedGameStats =
    gameStatsLookup[normalizeGameName(selectedGame.rawName)] ??
    gameStatsLookup[normalizeGameName(selectedGame.name)] ??
    (selectedGame.abbreviation
      ? gameStatsLookup[normalizeGameName(selectedGame.abbreviation)]
      : null) ??
    null

  const selectedGameStatsObject =
    selectedGameStats && typeof selectedGameStats === 'object' ? selectedGameStats : {}

  const leaderboardDataSource =
    leaderboardView === 'event' && eventData && typeof eventData === 'object'
      ? eventData
      : selectedGameStatsObject

  const uniqueMultiplierConfig = eventData?.['unique-multiplier'] ?? eventData?.['unique-multipliers']

  const eventLevelMultiplier = (() => {
    if (Array.isArray(uniqueMultiplierConfig)) {
      return uniqueMultiplierConfig[selectedGameIndex] ?? null
    }

    if (!uniqueMultiplierConfig || typeof uniqueMultiplierConfig !== 'object') {
      return null
    }

    return (
      uniqueMultiplierConfig[normalizeGameName(selectedGame.rawName)] ??
      uniqueMultiplierConfig[normalizeGameName(selectedGame.name)] ??
      (selectedGame.abbreviation
        ? uniqueMultiplierConfig[normalizeGameName(selectedGame.abbreviation)]
        : null) ??
      null
    )
  })()

  const inferredMultiplier =
    selectedGameIndex >= 0 && selectedGameIndex < defaultGameMultipliers.length
      ? defaultGameMultipliers[selectedGameIndex]
      : null

  const playerLeaderboard = sortLeaderboardEntries(
    Array.isArray(leaderboardDataSource['player-leaderboard'])
      ? leaderboardDataSource['player-leaderboard']
      : Array.isArray(leaderboardDataSource.players)
        ? leaderboardDataSource.players
        : Array.isArray(leaderboardDataSource['event-player-leaderboard'])
          ? leaderboardDataSource['event-player-leaderboard']
        : [],
  )

  const teamLeaderboard = sortLeaderboardEntries(
    Array.isArray(leaderboardDataSource['team-leaderboard'])
      ? leaderboardDataSource['team-leaderboard']
      : Array.isArray(leaderboardDataSource.teams)
        ? leaderboardDataSource.teams
        : Array.isArray(leaderboardDataSource['event-team-leaderboard'])
          ? leaderboardDataSource['event-team-leaderboard']
        : [],
  )

  const statRows = [
    {
      label: 'Placement Multiplier',
      value: formatMultiplier(
        selectedGameStatsObject.multiplier ??
          selectedGameStatsObject['placement-multiplier'] ??
          eventLevelMultiplier ??
          inferredMultiplier,
      ),
    },
    {
      label: 'Top Team',
      value: selectedGameStatsObject['top-team'],
    },
    {
      label: 'Top Player',
      value: selectedGameStatsObject['top-player'],
    },
    {
      label: 'Notes',
      value: selectedGameStatsObject.notes,
    },
  ]

  const knownGameStatKeys = new Set([
    'multiplier',
    'placement-multiplier',
    'top-team',
    'top-player',
    'notes',
    'player-leaderboard',
    'players',
    'team-leaderboard',
    'teams',
    'overall-team-leaderboard',
    'current-standings',
    'standings-impact',
    'overall-standings-impact',
  ])

  const additionalStatRows = Object.entries(selectedGameStatsObject)
    .filter(([key]) => !knownGameStatKeys.has(key))
    .map(([key, value]) => ({
      label: toLabel(key),
      value,
    }))

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))
  }

  return (
    <main className="event-page">
      <header className="page-header">
        <h1>The Coolio Championships LIVE Scores</h1>
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </header>

      <section className="filters" aria-label="Season and event selectors">
        <label>
          Season
          <select value={selectedSeason} onChange={handleSeasonChange}>
            {seasons.map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>
        </label>

        <label>
          Event
          <select value={selectedEvent} onChange={handleEventChange}>
            {eventNames.map((eventName) => (
              <option key={eventName} value={eventName}>
                {eventName}
              </option>
            ))}
          </select>
        </label>
      </section>

      {eventData ? (
        <section className="event-card" aria-live="polite">
          <div className="event-banner">
            <div className="event-title-row">
              <h2>{selectedEvent}</h2>
              {isLiveEvent ? (
                <span className="live-indicator" role="status" aria-label="Event is live">
                  <span className="live-dot" aria-hidden="true" />
                  LIVE
                </span>
              ) : null}
            </div>
            <div className="banner-tags">
              <span>{eventData.date || 'TBD'}</span>
              <span>Score: {eventData.score || 'TBD'}</span>
            </div>
          </div>

          <section className="stat-grid" aria-label="Event stats">
            <article>
              <h3>Points</h3>
              <p>{eventData.points ?? 'To Be Added Later'}</p>
            </article>
          </section>

          <section className="podium-grid" aria-label="Event results">
            <article className="result-column">
              <h3>Winners</h3>
              {winnerTeams.length > 0 ? (
                <div className="team-list">
                  {winnerTeams.map((team) => (
                    <div key={team.name} className="team-pill" style={{ '--team-color': team.color }}>
                      {team.logoUrl ? <img src={team.logoUrl} alt={`${team.name} logo`} /> : null}
                      <span>{team.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="result-empty">TBD</p>
              )}
            </article>

            <article className="result-column">
              <h3>Runner-ups</h3>
              {runnerUpTeams.length > 0 ? (
                <div className="team-list">
                  {runnerUpTeams.map((team) => (
                    <div key={team.name} className="team-pill" style={{ '--team-color': team.color }}>
                      {team.logoUrl ? <img src={team.logoUrl} alt={`${team.name} logo`} /> : null}
                      <span>{team.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="result-empty">TBD</p>
              )}
            </article>
          </section>

          <section className="games-section" aria-label="Game order">
            <h3>Game Order</h3>
            {gameOrderWithAssets.length > 0 ? (
              <div className="game-order-list">
                {gameOrderWithAssets.map((game, index) => (
                  <button
                    key={`${game.name}-${index}`}
                    type="button"
                    className={`game-chip ${index === selectedGameIndex ? 'is-active' : ''}`}
                    onClick={() => setSelectedGameIndex(index)}
                    aria-pressed={index === selectedGameIndex}
                  >
                    <span className="game-chip-order">{index + 1}</span>
                    {game.logoUrl ? (
                      <img className="game-chip-image" src={game.logoUrl} alt={`${game.name} logo`} />
                    ) : (
                      <span className="game-chip-text">{game.name}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="result-empty">TBD</p>
            )}

            <article className="game-stats-card" aria-live="polite">
              <h4>{selectedGame.name || 'Game stats'}</h4>
              {selectedGame.logoUrl ? (
                <img className="game-stats-logo" src={selectedGame.logoUrl} alt={`${selectedGame.name} logo`} />
              ) : null}

              {selectedGame.name ? (
                <div className="game-stats-grid">
                  {statRows.map((row) => (
                    <div key={row.label} className="game-stat-item">
                      <span>{row.label}</span>
                      <strong>{row.value ?? 'TBD'}</strong>
                    </div>
                  ))}

                  {additionalStatRows.map((row) => (
                    <div key={row.label} className="game-stat-item">
                      <span>{row.label}</span>
                      <strong>{String(row.value)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="result-empty">Select a game to view stats.</p>
              )}

              {selectedGame.name ? (
                <div className="leaderboard-layout">
                  <div className="leaderboard-toggle" role="tablist" aria-label="Leaderboard view">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={leaderboardView === 'game'}
                      className={`leaderboard-toggle-button ${leaderboardView === 'game' ? 'is-active' : ''}`}
                      onClick={() => setLeaderboardView('game')}
                    >
                      Game Leaderboard
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={leaderboardView === 'event'}
                      className={`leaderboard-toggle-button ${leaderboardView === 'event' ? 'is-active' : ''}`}
                      onClick={() => setLeaderboardView('event')}
                    >
                      Event Leaderboard
                    </button>
                  </div>

                  <section className="leaderboard-card" aria-label="Player leaderboard">
                    <h5>Player Leaderboard</h5>
                    <div className="leaderboard-table-wrap">
                      <table className="leaderboard-table">
                        <thead>
                          <tr>
                            <th scope="col">#</th>
                            <th scope="col">Player</th>
                            <th scope="col">Team</th>
                            <th scope="col">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerLeaderboard.length > 0 ? (
                            playerLeaderboard.map((row, index) => (
                              <tr key={`${row.player ?? row.name ?? 'player'}-${index}`}>
                                <td>{row.place ?? index + 1}</td>
                                <td>{row.player ?? row.name ?? 'TBD'}</td>
                                <td>{row.team ?? 'TBD'}</td>
                                <td>{row.points ?? row.coins ?? 'TBD'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td>1</td>
                              <td>TBD</td>
                              <td>TBD</td>
                              <td>TBD</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="leaderboard-card" aria-label="Team leaderboard">
                    <h5>Team Leaderboard</h5>
                    <div className="leaderboard-table-wrap">
                      <table className="leaderboard-table">
                        <thead>
                          <tr>
                            <th scope="col">#</th>
                            <th scope="col">Team</th>
                            <th scope="col">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamLeaderboard.length > 0 ? (
                            teamLeaderboard.map((row, index) => (
                              <tr key={`${row.team ?? row.name ?? 'team'}-${index}`}>
                                <td>{row.place ?? index + 1}</td>
                                <td>{row.team ?? row.name ?? 'TBD'}</td>
                                <td>{row.points ?? row.coins ?? 'TBD'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td>1</td>
                              <td>TBD</td>
                              <td>TBD</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                </div>
              ) : null}
            </article>
          </section>
        </section>
      ) : (
        <p className="empty-state">No event data available.</p>
      )}
    </main>
  )
}

export default App
