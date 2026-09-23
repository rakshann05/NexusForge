'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { listOrganizations, Organization } from '../lib/organizations';

/** Sidebar control listing the user's organizations and linking to each. */
export function OrgSwitcher() {
  const params = useParams<{ organizationId?: string }>();
  const activeId = params?.organizationId;
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listOrganizations()
      .then((list) => active && setOrgs(list))
      .catch(() => active && setOrgs([]));
    return () => {
      active = false;
    };
  }, []);

  const activeOrg = orgs?.find((o) => o.id === activeId);
  const label = activeOrg?.name ?? 'Organizations';

  return (
    <div className="org-switcher">
      <button
        type="button"
        className="org-switcher-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="org-avatar">{label[0]?.toUpperCase() ?? 'N'}</span>
        <span className="org-switcher-label">{label}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="org-menu" role="listbox" aria-label="Organizations">
          {orgs === null && <div className="org-menu-empty muted">Loading…</div>}
          {orgs?.length === 0 && <div className="org-menu-empty muted">No organizations yet.</div>}
          {orgs?.map((o) => (
            <Link
              key={o.id}
              href={`/organizations/${o.id}`}
              className={o.id === activeId ? 'org-menu-item active' : 'org-menu-item'}
              onClick={() => setOpen(false)}
              role="option"
              aria-selected={o.id === activeId}
            >
              <span className="org-avatar sm">{o.name[0]?.toUpperCase()}</span>
              <span style={{ minWidth: 0 }}>
                <b>{o.name}</b>
                <br />
                <span className="muted" style={{ fontSize: 12, textTransform: 'capitalize' }}>{o.role.toLowerCase()}</span>
              </span>
            </Link>
          ))}
          <Link href="/organizations" className="org-menu-item create" onClick={() => setOpen(false)}>
            + New / manage organizations
          </Link>
        </div>
      )}
    </div>
  );
}
