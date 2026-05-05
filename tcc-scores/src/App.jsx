import { useEffect, useMemo, useState } from 'react'
import events from '../data/events.json'
import teams from '../data/teams.json'
import './App.css'

const normalizeTeamName = (name) => name.toLowerCase().replaceAll('_', ' ').trim()

const toLabel = (name) => name.replaceAll('_', ' ')

function App() {
  const getInitialTheme = () => {
    const storedTheme = localStorage.getItem('theme')

    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const [theme, setTheme] = useState(getInitialTheme)
  const seasons = useMemo(() => Object.keys(events), [])
  const [selectedSeason, setSelectedSeason] = useState(seasons[0] ?? '')

  const eventNames = useMemo(() => {
    if (!selectedSeason || !events[selectedSeason]) {
      return []
    }

    return Object.keys(events[selectedSeason])
  }, [selectedSeason])

  const [selectedEvent, setSelectedEvent] = useState(eventNames[0] ?? '')

  const eventData = useMemo(() => {
    if (!selectedSeason || !selectedEvent) {
      return null
    }

    return events[selectedSeason]?.[selectedEvent] ?? null
  }, [selectedSeason, selectedEvent])

  const handleSeasonChange = (event) => {
    const nextSeason = event.target.value
    const nextEventNames = Object.keys(events[nextSeason] ?? {})

    setSelectedSeason(nextSeason)
    setSelectedEvent(nextEventNames[0] ?? '')
  }

  const handleEventChange = (event) => {
    setSelectedEvent(event.target.value)
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

  const teamLookup = useMemo(() => {
    return Object.entries(teams).reduce((lookup, [teamName, teamData]) => {
      lookup[normalizeTeamName(teamName)] = {
        name: toLabel(teamName),
        color: teamData.color,
        logoUrl: new URL(`../images/${teamData.logo}`, import.meta.url).href,
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
        <h1>The Coolio Championships Scores</h1>
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
            <h2>{selectedEvent}</h2>
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
            {gameOrder.length > 0 ? (
              <div className="game-order-list">
                {gameOrder.map((game, index) => (
                  <span key={`${game}-${index}`} className="game-chip">
                    {index + 1}. {game}
                  </span>
                ))}
              </div>
            ) : (
              <p className="result-empty">TBD</p>
            )}
          </section>
        </section>
      ) : (
        <p className="empty-state">No event data available.</p>
      )}
    </main>
  )
}

export default App
