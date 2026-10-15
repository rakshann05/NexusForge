'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '../../../../../../../components/shell';
import { useAuth } from '../../../../../../../lib/auth-context';
import { ApiError } from '../../../../../../../lib/api';
import { getProject, listProjectMembers, Project, ProjectMember } from '../../../../../../../lib/projects';
import {
  addTaskComment,
  canContributeProject,
  deleteTask,
  deleteTaskComment,
  getTask,
  listTaskComments,
  STATUS_LABEL,
  Task,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskComment,
  TaskPriority,
  TaskStatus,
  updateTask,
} from '../../../../../../../lib/tasks';

export default function TaskDetail() {
  const params = useParams<{ organizationId: string; projectId: string; taskId: string }>();
  const { organizationId, projectId, taskId } = params;
  const router = useRouter();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('BACKLOG');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);

  const [commentBody, setCommentBody] = useState('');
  const [commenting, setCommenting] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const [p, t, m, c] = await Promise.all([
        getProject(organizationId, projectId),
        getTask(organizationId, projectId, taskId),
        listProjectMembers(organizationId, projectId),
        listTaskComments(organizationId, projectId, taskId),
      ]);
      setProject(p);
      setTask(t);
      setMembers(m);
      setComments(c);
      setTitle(t.title);
      setDescription(t.description ?? '');
      setStatus(t.status);
      setPriority(t.priority);
      setAssigneeId(t.assignee?.id ?? '');
      setState('ready');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load task.');
      setState('error');
    }
  }, [organizationId, projectId, taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const canContribute = project ? canContributeProject(project.role) : false;

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const updated = await updateTask(organizationId, projectId, taskId, {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId,
      });
      setTask(updated);
      setNotice('Task saved.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save task.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteTask() {
    setError(null);
    try {
      await deleteTask(organizationId, projectId, taskId);
      router.push(`/organizations/${organizationId}/projects/${projectId}/board`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete task.');
    }
  }

  async function onAddComment(event: FormEvent) {
    event.preventDefault();
    if (commentBody.trim().length < 1) return;
    setCommenting(true);
    setError(null);
    try {
      await addTaskComment(organizationId, projectId, taskId, commentBody.trim());
      setCommentBody('');
      setComments(await listTaskComments(organizationId, projectId, taskId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add comment.');
    } finally {
      setCommenting(false);
    }
  }

  async function onDeleteComment(commentId: string) {
    setError(null);
    try {
      await deleteTaskComment(organizationId, projectId, taskId, commentId);
      setComments(await listTaskComments(organizationId, projectId, taskId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete comment.');
    }
  }

  if (state === 'loading') {
    return (
      <Shell>
        <header className="topbar">
          <h1>Loading…</h1>
        </header>
      </Shell>
    );
  }

  if (state === 'error' || !task) {
    return (
      <Shell>
        <header className="topbar">
          <h1>Task</h1>
        </header>
        <section className="card" style={{ marginTop: 24 }}>
          <div className="alert alert-error" role="alert">
            {error ?? 'Task not found.'}
          </div>
          <Link className="back" href={`/organizations/${organizationId}/projects/${projectId}/board`}>
            ← Back to board
          </Link>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">
            <Link href={`/organizations/${organizationId}/projects/${projectId}/board`} style={{ color: 'inherit' }}>
              {project?.name ?? 'Project'} · Board
            </Link>
          </div>
          <h1>{task.title}</h1>
        </div>
      </header>

      {notice && (
        <div className="alert alert-success" role="status" style={{ marginTop: 8 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      <section className="grid content" style={{ marginTop: 16 }}>
        <article className="card">
          <h2>Details</h2>
          <form onSubmit={onSave} noValidate>
            <label htmlFor="task-title">
              Title <span className="req">*</span>
              <input id="task-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={280} disabled={!canContribute || saving} required />
            </label>
            <label htmlFor="task-description">
              Description
              <textarea id="task-description" className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} disabled={!canContribute || saving} style={{ minHeight: 120 }} />
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 140px' }}>
                Status
                <select id="task-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} disabled={!canContribute || saving}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flex: '1 1 140px' }}>
                Priority
                <select id="task-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} disabled={!canContribute || saving}>
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flex: '1 1 140px' }}>
                Assignee
                <select id="task-assignee" className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} disabled={!canContribute || saving}>
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {canContribute && (
              <button className="button" type="submit" disabled={saving} aria-busy={saving}>
                {saving ? 'Saving…' : 'Save task'}
              </button>
            )}
          </form>
        </article>

        <aside className="grid">
          <article className="card">
            <h2>Comments</h2>
            {comments.length === 0 && <p className="muted" style={{ fontSize: 14 }}>No comments yet.</p>}
            {comments.map((c) => (
              <div className="comment" key={c.id}>
                <div className="who">
                  <b>{c.author.displayName}</b> <span className="when">· {new Date(c.createdAt).toLocaleString()}</span>
                  {(c.author.id === user?.id || canContributeProject(project?.role ?? null)) && (
                    <button type="button" className="linkbtn" style={{ color: '#b42318', marginLeft: 8 }} onClick={() => onDeleteComment(c.id)}>
                      delete
                    </button>
                  )}
                </div>
                <div className="body">{c.body}</div>
              </div>
            ))}
            {canContribute && (
              <form onSubmit={onAddComment} style={{ marginTop: 12 }}>
                <label htmlFor="comment-body" className="sr-only">
                  Add a comment
                </label>
                <textarea id="comment-body" className="input" value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add a comment…" maxLength={5000} disabled={commenting} />
                <button className="button" type="submit" disabled={commenting} aria-busy={commenting}>
                  {commenting ? 'Posting…' : 'Comment'}
                </button>
              </form>
            )}
          </article>

          {canContribute && (
            <article className="card">
              <h2>Danger zone</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Deleting a task is permanent.
              </p>
              <button type="button" className="danger" onClick={onDeleteTask}>
                Delete task
              </button>
            </article>
          )}
        </aside>
      </section>
    </Shell>
  );
}
