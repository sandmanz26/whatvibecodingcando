/** A skill read the way Claude reads it: the frontmatter, then the page. */
export function SkillDoc({ skill }: { skill: { name: string; description: string; tools: string[]; triggers: string[]; instructions: string; examples?: string[] } }) {
  const steps = skill.instructions.split('\n').map((l) => l.trim()).filter(Boolean)
  const numbered = steps.every((l) => /^\d+\./.test(l))
  return (
    <article className="v2-doc" aria-label="SKILL.md">
      <pre className="frontmatter">{`name: ${skill.name || 'untitled-skill'}\ndescription: ${skill.description || '…'}${skill.tools.length ? `\nallowed-tools: ${skill.tools.join(', ')}` : ''}`}</pre>
      {skill.triggers.filter(Boolean).length > 0 && (
        <>
          <h2>When to use</h2>
          <ul>{skill.triggers.filter(Boolean).map((t) => <li key={t}>“{t}”</li>)}</ul>
        </>
      )}
      <h2>Instructions</h2>
      {steps.length === 0 ? <p style={{ color: 'var(--muted)' }}>No instructions yet.</p>
        : numbered ? <ol>{steps.map((l) => <li key={l}>{l.replace(/^\d+\.\s*/, '')}</li>)}</ol>
          : steps.map((l) => <p key={l} style={{ marginBottom: 8 }}>{l}</p>)}
      {(skill.examples ?? []).filter(Boolean).length > 0 && (
        <>
          <h2>Examples</h2>
          <ul>{(skill.examples ?? []).filter(Boolean).map((e) => <li key={e}>{e}</li>)}</ul>
        </>
      )}
    </article>
  )
}
