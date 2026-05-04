import teams from '../data/teams.json'
import './App.css'

function App() {
  const teamEntries = Object.entries(teams)

  return (
    <main className="team-page">
      <h1>Teams</h1>
      <section className="team-grid" aria-label="Team list">
        {teamEntries.map(([teamName, team]) => {
          const logoUrl = new URL(`../images/${team.logo}`, import.meta.url).href
          const label = teamName.replaceAll('_', ' ')

          return (
            <article
              className="team-card"
              key={teamName}
              style={{
                '--team-color': team.color,
              }}
            >
              <img src={logoUrl} alt={`${label} logo`} className="team-logo" />
              <h2>{label}</h2>
            </article>
          )
        })}
      </section>
    </main>
  )
}

export default App
