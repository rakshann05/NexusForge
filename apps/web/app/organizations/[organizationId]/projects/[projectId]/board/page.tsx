'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shell } from '../../../../../../components/shell';
import { ApiError } from '../../../../../../lib/api';
import { getProject, listProjectMembers, Project, ProjectMember } from '../../../../../../lib/projects';
import {
  canContributeProject,
  createTask,
  listTasks,
  moveTask,
  STATUS_LABEL,
  Task,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskPriority,
  TaskStatus,
} from '../../../../../../lib/tasks';

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <span className={`prio ${priority.toLowerCase()}`}>{priority.toLowerCase()}</span>;
}

export default function BoardPage() {
  const params = useParams<{ organizationId: string; projectId: string }>();
  const { organizationId, projectId } = params;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterPriority, setFilterPriority] = useState<'' | TaskPriority>('');
  const [filterAssignee, setFilterAssignee] = useState('');

  // Create form
  const [title, setTitle] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('BACKLOG');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');
  const [newAssignee, setNewAssignee] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTasks = useCallback(async () => {
    const list = await listTasks(organizationId, projectId, {
      priority: filterPriority || undefined,
      assigneeId: filterAssignee || undefined,
    });
    setTasks(list);
  }, [organizationId, projectId, filterPriority, filterAssignee]);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const [p, m] = await Promise.all([getProject(organizationId, projectId), listProjectMembers(organizationId, projectId)]);
      setProject(p);
      setMembers(m);
      await loadTasks();
      setState('ready');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load board.');
      setState('error');
    }
  }, [organizationId, projectId, loadTasks]);

  useEffect(() => {
    load();
  }, [organizationId, projectId]);

  useEffect(() => {
    if (state === 'ready') loadTasks().catch(() => undefined);
  }, [filterPriority, filterAssignee]);

  const canContribute = project ? canContributeProject(project.role) : false;

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (title.trim().length < 1) return;
    setCreating(true);
    try {
      await createTask(organizationId, projectId, {
        title: title.trim(),
        status: newStatus,
        priority: newPriority,
        assigneeId: newAssignee || undefined,
      });
      setTitle('');
      await loadTasks();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create task.');
    } finally {
      setCreating(false);
    }
  }

  async function onMove(task: Task, status: TaskStatus) {
    setError(null);
    try {
      await moveTask(organizationId, projectId, task.id, status, Date.now());
      await loadTasks();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not move task.');
    }
  }

  if (state === 'error') {
    return (
      <Shell>
        <header className="topbar">
          <h1>Board</h1>
        </header>
        <section className="card" style={{ marginTop: 24 }}>
          <div className="alert alert-error" role="alert">
            {error ?? 'Failed to load.'}
          </div>
        </section>
      </Shell>
    );
  }

  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">
            <Link href={`/organizations/${organizationId}/projects/${projectId}`} style={{ color: 'inherit' }}>
              {project?.name ?? 'Project'}
            </Link>
          </div>
          <h1>Board</h1>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      {canContribute && (
        <section className="card" style={{ marginTop: 16 }}>
          <form onSubmit={onCreate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ flex: '2 1 220px' }}>
              New task
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" maxLength={280} disabled={creating} required />
            </label>
            <label>
              Status
              <select className="input" value={newStatus} onChange={(e) => setNewStatus(e.target.value as TaskStatus)} disabled={creating}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select className="input" value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority)} disabled={creating}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assignee
              <select className="input" value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} disabled={creating}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" type="submit" disabled={creating} aria-busy={creating}>
              {creating ? 'Adding…' : 'Add task'}
            </button>
          </form>
        </section>
      )}

      <section className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label>
            Filter priority
            <select className="input" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as TaskPriority | '')}>
              <option value="">All</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter assignee
            <select className="input" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
              <option value="">Anyone</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.displayName}
                </option>
              ))}
            </select>
          </label>
          <span className="muted" style={{ fontSize: 13 }}>{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <div className="board">
          {TASK_STATUSES.map((status) => {
            const items = byStatus(status);
            return (
              <div className="board-col" key={status}>
                <h3>
                  {STATUS_LABEL[status]} <span className="count">{items.length}</span>
                </h3>
                {items.map((task) => (
                  <div className="task-card" key={task.id}>
                    <Link className="task-card-title" href={`/organizations/${organizationId}/projects/${projectId}/tasks/${task.id}`}>
                      {task.title}
                    </Link>
                    <div className="meta">
                      <PriorityBadge priority={task.priority} />
                      <span>{task.assignee ? task.assignee.displayName : 'Unassigned'}</span>
                      {task.commentCount > 0 && <span>💬 {task.commentCount}</span>}
                    </div>
                    {canContribute && (
                      <div className="move">
                        <label className="sr-only" htmlFor={`move-${task.id}`}>
                          Move {task.title}
                        </label>
                        <select
                          id={`move-${task.id}`}
                          className="input"
                          aria-label={`Move ${task.title} to another status`}
                          value={task.status}
                          onChange={(e) => onMove(task, e.target.value as TaskStatus)}
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && <p className="muted" style={{ fontSize: 12, padding: '4px' }}>No tasks</p>}
              </div>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}
