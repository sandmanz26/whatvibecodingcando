import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Minus } from 'lucide-react'
import { useStore, useCan } from '../store/store'
import { Avatar, Lens, StageBadge, TeamTag } from '../components/ui'
import { Sparkline } from '../components/charts'
import { LENS } from '../data/lens'
import { ALL_PERMISSIONS, PERMISSION_LABELS, ROLES, can, dateLabel, fmt, minimumRole, sum, teamWeekly } from '../lib/logic'
import type { Role } from '../data/types'

type Tab = 'members' | 'matrix' | 'roles'

export default function Team() {
  const { members, teams, skills, me, dispatch, toast } = useStore()
  const allowed = useCan()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('members')
  const live = skills.filter((s) => s.stage !== 'deprecated')

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Team & access</h1>
          <p>{members.length} people across {teams.length} teams. Roles decide what people can do; access decides which skills each team sees.</p>
        </div>
      </div>

      <Lens info={LENS.team} />

      <div className="grid g-4" style={{ marginBottom: 20 }}>
        {teams.map((t) => {
          const weekly = teamWeekly(skills, t.id)
          return (
            <section key={t.id} className="card stat">
              <div className="row" style={{ gap: 8 }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: `var(--s${t.slot})` }} />
                <span className="stat-label" style={{ color: 'var(--ink)', fontWeight: 600 }}>{t.name}</span>
              </div>
              <div className="stat-foot" style={{ alignItems: 'flex-end' }}>
                <div>
                  <div className="stat-value num" style={{ fontSize: 22 }}>{fmt(sum(weekly.slice(-4)))}</div>
                  <div className="muted" style={{ fontSize: 12 }}>runs · 4 wks</div>
                  <div className="secondary" style={{ fontSize: 12, marginTop: 6 }}>{members.filter((m) => m.teamId === t.id).length} people · {live.filter((s) => s.teamIds.includes(t.id)).length} skills</div>
                </div>
                <Sparkline values={weekly} color={`var(--s${t.slot})`} />
              </div>
            </section>
          )
        })}
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'members'} onClick={() => setTab('members')}>Members<span className="count">{members.length}</span></button>
        <button role="tab" aria-selected={tab === 'matrix'} onClick={() => setTab('matrix')}>Access matrix</button>
        <button role="tab" aria-selected={tab === 'roles'} onClick={() => setTab('roles')}>Roles & permissions</button>
      </div>

      {tab === 'members' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Person</th><th>Team</th><th>Role</th><th className="r">Skills owned</th><th className="r">Runs of their skills · 4 wks</th><th className="r">Joined</th></tr></thead>
            <tbody>
              {members.map((m) => {
                const owned = skills.filter((s) => s.ownerId === m.id && s.stage !== 'deprecated')
                const canEdit = allowed('members.manage') && m.id !== me.id
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar member={m} size="lg" />
                        <div>
                          <div style={{ fontWeight: 550 }}>{m.name}{m.id === me.id && <span className="muted" style={{ fontWeight: 450 }}> · you</span>}</div>
                          <div className="muted" style={{ fontSize: 12.5 }}>{m.title}</div>
                        </div>
                      </div>
                    </td>
                    <td><TeamTag id={m.teamId} /></td>
                    <td>
                      {canEdit ? (
                        <select className="select" style={{ width: 130, height: 30, fontSize: 13 }} value={m.role} aria-label={`Role for ${m.name}`}
                          onChange={(e) => { dispatch({ type: 'setRole', memberId: m.id, role: e.target.value as Role }); toast(`${m.name} is now ${e.target.value}`) }}>
                          {ROLES.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className="tip" data-tip={m.id === me.id ? 'You can’t change your own role' : `Needs ${minimumRole('members.manage')} role`}><span className="badge">{m.role}</span></span>
                      )}
                    </td>
                    <td className="r num">{owned.length || '—'}</td>
                    <td className="r num">{owned.length ? fmt(sum(owned.map((s) => sum(s.usage.slice(-4))))) : '—'}</td>
                    <td className="r muted">{dateLabel(m.joinedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'matrix' && (
        <section className="card">
          <div className="card-head">
            <div><h2>Which team sees which skill</h2><p>{allowed('access.manage') ? 'Click a box to grant or revoke. Changes are logged.' : `Read-only — needs ${minimumRole('access.manage')} role to change.`}</p></div>
          </div>
          <div className="card-body matrix">
            <table>
              <thead>
                <tr><th>Skill</th><th style={{ textAlign: 'left' }}>Stage</th>{teams.map((t) => <th key={t.id}><span className="row" style={{ justifyContent: 'center', gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: `var(--s${t.slot})` }} />{t.name}</span></th>)}</tr>
              </thead>
              <tbody>
                {live.map((s) => (
                  <tr key={s.id}>
                    <td><button className="btn ghost sm" style={{ padding: '0 4px', fontWeight: 550, color: 'var(--ink)' }} onClick={() => nav(`/skills/${s.id}`)}>{s.title}</button></td>
                    <td style={{ textAlign: 'left' }}><StageBadge stage={s.stage} /></td>
                    {teams.map((t) => {
                      const on = s.teamIds.includes(t.id)
                      const ok = allowed('access.manage')
                      return (
                        <td key={t.id}>
                          <button className="cbox" role="checkbox" aria-checked={on} aria-disabled={!ok} aria-label={`${s.title} for ${t.name}`}
                            onClick={() => { if (!ok) return toast(`Needs ${minimumRole('access.manage')} role to change access`, 'error'); dispatch({ type: 'toggleAccess', id: s.id, teamId: t.id }) }}>
                            {on && <Check size={13} strokeWidth={3} />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'roles' && (
        <section className="card">
          <div className="card-head"><div><h2>What each role can do</h2><p>Use “Viewing as” in the sidebar to try any role.</p></div></div>
          <div className="card-body matrix">
            <table>
              <thead>
                <tr><th>Permission</th>{ROLES.map((r) => <th key={r} style={{ color: r === me.role ? 'var(--ink)' : undefined }}>{r}{r === me.role && <div style={{ fontSize: 11, color: 'var(--accent)' }}>you</div>}</th>)}</tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map((p) => (
                  <tr key={p}>
                    <td>{PERMISSION_LABELS[p]}</td>
                    {ROLES.map((r) => {
                      const has = can({ ...me, role: r }, p)
                      return (
                        <td key={r} style={{ background: r === me.role ? 'var(--surface-2)' : undefined }}>
                          {has ? <Check size={15} strokeWidth={2.6} color="var(--good-ink)" aria-label="Allowed" /> : <Minus size={15} color="var(--ink-3)" aria-label="Not allowed" />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Members can edit and submit only the skills they own. Nobody can approve their own skill.</p>
          </div>
        </section>
      )}
    </main>
  )
}
