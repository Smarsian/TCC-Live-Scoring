import { useEffect, useMemo, useState } from 'react'
import events from '../data/events.json'
import './App.css'

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
        <h1>TCC Events</h1>
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
          <h2>{selectedEvent}</h2>
          <dl>
            <div>
              <dt>Date</dt>
              <dd>{eventData.date || 'TBD'}</dd>
            </div>
            <div>
              <dt>Players</dt>
              <dd>{eventData.players ?? 'TBD'}</dd>
            </div>
            <div>
              <dt>Teams</dt>
              <dd>{eventData.teams ?? 'TBD'}</dd>
            </div>
            <div>
              <dt>Game Order</dt>
              <dd>{gameOrder.length > 0 ? gameOrder.join(' -> ') : 'TBD'}</dd>
            </div>
            <div>
              <dt>Winner</dt>
              <dd>{winners.length > 0 ? winners.join(', ') : 'TBD'}</dd>
            </div>
            <div>
              <dt>Runner-up</dt>
              <dd>{runnerUps.length > 0 ? runnerUps.join(', ') : 'TBD'}</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd>{eventData.score || 'TBD'}</dd>
            </div>
            <div>
              <dt>Points</dt>
              <dd>{eventData.points ?? 'To Be Added Later'}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <p className="empty-state">No event data available.</p>
      )}
    </main>
  )
}

export default App
