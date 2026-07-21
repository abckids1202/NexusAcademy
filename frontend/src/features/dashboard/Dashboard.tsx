import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookOpen, Brain, FlaskConical, Map, PenLine, Swords } from 'lucide-react';
import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, demoLogin, Skill } from '../../api/client';
import { ModeButton } from '../../components/ModeButton';

const masteryTrend = [
  { day: 'Mon', score: 32 },
  { day: 'Tue', score: 38 },
  { day: 'Wed', score: 41 },
  { day: 'Thu', score: 47 },
  { day: 'Fri', score: 53 }
];

export function Dashboard() {
  const [mode, setMode] = useState('practice');
  const [answer, setAnswer] = useState('4');
  const [draft, setDraft] = useState('School gardens help students because they make science visible and give classes shared evidence to discuss.');

  const auth = useMutation({
    mutationFn: demoLogin,
    onSuccess(data) {
      localStorage.setItem('nexus_token', data.access_token);
    }
  });

  const skills = useQuery({ queryKey: ['skills'], queryFn: () => api<Skill[]>('/skills'), enabled: Boolean(localStorage.getItem('nexus_token')) });
  const recommendations = useQuery({ queryKey: ['recommendations'], queryFn: () => api<Array<{ skill: Skill; why: string }>>('/skills/recommended'), enabled: Boolean(localStorage.getItem('nexus_token')) });
  const practice = useMutation({
    mutationFn: async () => {
      const session = await api<{ id: string }>('/practice/sessions?skill_id=alg-linear-equations', { method: 'POST' });
      return api(`/practice/sessions/${session.id}/answers`, { method: 'POST', body: JSON.stringify({ answer, confidence: 4, used_hints: 0 }) });
    }
  });
  const writing = useMutation({
    mutationFn: async () => {
      const project = await api<{ id: string }>('/writing/projects', {
        method: 'POST',
        body: JSON.stringify({ title: 'Garden argument', writing_type: 'argumentative', prompt: 'Make a claim with evidence.', content: draft })
      });
      return api(`/writing/projects/${project.id}/analyze`, { method: 'POST' });
    }
  });
  const expedition = useMutation({
    mutationFn: () => api('/expeditions/generate', { method: 'POST', body: JSON.stringify({ goal: 'I want to understand derivatives but I am weak at functions.', session_minutes: 35, subject: 'mathematics' }) })
  });

  const loggedIn = Boolean(localStorage.getItem('nexus_token'));

  return (
    <main className="min-h-screen bg-nexus-mist">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-nexus-teal">Explorer Command</p>
            <h1 className="text-3xl font-bold text-nexus-ink">Nexus Academy</h1>
          </div>
          <button
            className="rounded-md bg-nexus-ink px-4 py-2 font-semibold text-white"
            onClick={() => auth.mutate()}
          >
            {loggedIn ? 'Session Ready' : 'Start Demo Session'}
          </button>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[72px_minmax(0,1fr)_340px]">
        <nav className="flex gap-2 lg:flex-col" aria-label="Learning modes">
          <ModeButton icon={Swords} label="Practice Arena" active={mode === 'practice'} onClick={() => setMode('practice')} />
          <ModeButton icon={Map} label="Adventure Mode" active={mode === 'adventure'} onClick={() => setMode('adventure')} />
          <ModeButton icon={Brain} label="AI Expedition" active={mode === 'expedition'} onClick={() => setMode('expedition')} />
          <ModeButton icon={PenLine} label="Writing Studio" active={mode === 'writing'} onClick={() => setMode('writing')} />
          <ModeButton icon={FlaskConical} label="Simulation Lab" active={mode === 'simulation'} onClick={() => setMode('simulation')} />
        </nav>

        <motion.div layout className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          {mode === 'practice' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Linear Equation Repair</h2>
              <p className="text-slate-600">Solve for x: 2x + 3 = 11</p>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={answer} onChange={(event) => setAnswer(event.target.value)} />
              <button className="rounded-md bg-nexus-teal px-4 py-2 font-semibold text-white" onClick={() => practice.mutate()} disabled={!loggedIn}>Check Deterministically</button>
              {practice.data ? <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-sm text-white">{JSON.stringify(practice.data, null, 2)}</pre> : null}
            </div>
          )}

          {mode === 'adventure' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Bridge of Balanced Forces</h2>
              <p className="text-slate-600">Stabilize a bridge by repairing a corrupted equation chain. Boss battle: The Sign Weaver.</p>
              <div className="grid gap-3 md:grid-cols-4">
                {['Diagnose', 'Repair', 'Solve', 'Explain'].map((stage) => <div className="rounded-md border border-slate-200 p-3 font-semibold" key={stage}>{stage}</div>)}
              </div>
            </div>
          )}

          {mode === 'expedition' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Adaptive Expedition Planner</h2>
              <p className="text-slate-600">Generate a route for derivatives with function prerequisites.</p>
              <button className="rounded-md bg-nexus-coral px-4 py-2 font-semibold text-white" onClick={() => expedition.mutate()} disabled={!loggedIn}>Generate Route</button>
              {expedition.data ? <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-sm text-white">{JSON.stringify(expedition.data, null, 2)}</pre> : null}
            </div>
          )}

          {mode === 'writing' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Argument Writing Studio</h2>
              <textarea className="min-h-40 w-full rounded-md border border-slate-300 px-3 py-2" value={draft} onChange={(event) => setDraft(event.target.value)} />
              <button className="rounded-md bg-nexus-gold px-4 py-2 font-semibold text-nexus-ink" onClick={() => writing.mutate()} disabled={!loggedIn}>Analyze Draft</button>
              {writing.data ? <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-sm text-white">{JSON.stringify(writing.data, null, 2)}</pre> : null}
            </div>
          )}

          {mode === 'simulation' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Function Transformation Lab</h2>
              <div className="grid aspect-[16/9] place-items-center rounded-md border border-slate-200 bg-gradient-to-br from-white to-slate-100">
                <BookOpen size={72} className="text-nexus-teal" />
              </div>
            </div>
          )}
        </motion.div>

        <aside className="space-y-5">
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-bold">Skill Map</h2>
            <div className="mt-3 space-y-2">
              {(skills.data ?? []).slice(0, 6).map((skill) => (
                <div className="rounded-md border border-slate-200 p-3" key={skill.id}>
                  <div className="font-semibold">{skill.name}</div>
                  <div className="text-sm text-slate-500">Difficulty {skill.difficulty}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-bold">Mastery Trend</h2>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={masteryTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="score" stroke="#1b998b" fill="#1b998b" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-bold">Why Next?</h2>
            <p className="mt-2 text-sm text-slate-600">{recommendations.data?.[0]?.why ?? 'Start a demo session to receive transparent recommendations.'}</p>
          </section>
        </aside>
      </section>
    </main>
  );
}

