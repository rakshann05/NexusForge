/**
 * NexusForge database seed.
 *
 * Seeds development-safe foundational data only:
 *  - System roles (OWNER, ADMIN, MEMBER, GUEST)
 *  - Permissions used by the RBAC guards
 *  - The role -> permission grants
 *
 * The seed is fully idempotent: running it repeatedly converges to the same
 * state without creating duplicates. No production users or secrets are ever
 * created. An OPTIONAL local-only user can be seeded via environment variables
 * (see DEV_SEED_USER_* below); it is refused when NODE_ENV=production.
 */
import { PrismaClient, SystemRoleKey } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Canonical permission catalogue. Keys are `resource:action` strings that the
// PermissionsGuard checks against. Descriptions are human-facing only.
const PERMISSIONS: Record<string, string> = {
  'organization:create': 'Create organizations',
  'organization:read': 'View organizations',
  'organization:update': 'Update organization settings',
  'organization:delete': 'Delete an organization',
  'organization:manage_members': 'Invite, remove, and change roles of members',

  'project:create': 'Create projects',
  'project:read': 'View projects',
  'project:update': 'Update projects',
  'project:delete': 'Delete projects',

  'task:create': 'Create tasks',
  'task:read': 'View tasks',
  'task:update': 'Update tasks',
  'task:delete': 'Delete tasks',
  'task:assign': 'Assign tasks to members',

  'document:create': 'Create documents',
  'document:read': 'View documents',
  'document:update': 'Update documents',
  'document:delete': 'Delete documents',
};

const ALL = Object.keys(PERMISSIONS);
const readOnly = ALL.filter((key) => key.endsWith(':read'));

// Role -> granted permission keys. OWNER holds everything; ADMIN holds
// everything except destroying the organization; MEMBER can collaborate but
// not administer; GUEST is read-only.
const ROLE_GRANTS: Record<SystemRoleKey, { description: string; permissions: string[] }> = {
  [SystemRoleKey.OWNER]: { description: 'Organization owner with full control', permissions: ALL },
  [SystemRoleKey.ADMIN]: {
    description: 'Administrator with full control except deleting the organization',
    permissions: ALL.filter((key) => key !== 'organization:delete'),
  },
  [SystemRoleKey.MEMBER]: {
    description: 'Standard workspace member',
    permissions: [
      'organization:read',
      'project:read',
      'project:create',
      'project:update',
      'task:create',
      'task:read',
      'task:update',
      'task:assign',
      'document:create',
      'document:read',
      'document:update',
    ],
  },
  [SystemRoleKey.GUEST]: { description: 'Read-only guest access', permissions: readOnly },
};

async function seedPermissions() {
  const byKey = new Map<string, string>();
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
    byKey.set(key, permission.id);
  }
  return byKey;
}

async function seedRoles(permissionIdByKey: Map<string, string>) {
  for (const key of Object.keys(ROLE_GRANTS) as SystemRoleKey[]) {
    const grant = ROLE_GRANTS[key];
    const role = await prisma.role.upsert({
      where: { key },
      update: { description: grant.description },
      create: { key, description: grant.description },
    });

    const desiredIds = grant.permissions.map((permissionKey) => {
      const id = permissionIdByKey.get(permissionKey);
      if (!id) throw new Error(`Unknown permission "${permissionKey}" granted to role ${key}`);
      return id;
    });

    // Ensure every desired grant exists (idempotent).
    for (const permissionId of desiredIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }

    // Reconcile: drop grants that are no longer part of the desired set so the
    // seed converges when the catalogue changes, without touching other roles.
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: desiredIds } },
    });
  }
}

/**
 * Optional local development user. Enabled only when both env vars are set and
 * NODE_ENV is not production. The password is read from the environment and is
 * never hardcoded or logged.
 */
async function seedDevUser() {
  const email = process.env.DEV_SEED_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.DEV_SEED_USER_PASSWORD;
  if (!email) return;

  if (process.env.NODE_ENV === 'production') {
    console.warn('[seed] DEV_SEED_USER_EMAIL is set but ignored because NODE_ENV=production.');
    return;
  }
  if (!password) {
    console.warn('[seed] DEV_SEED_USER_EMAIL is set but DEV_SEED_USER_PASSWORD is missing; skipping dev user.');
    return;
  }

  const memberRole = await prisma.role.findUniqueOrThrow({ where: { key: SystemRoleKey.MEMBER } });
  const passwordHash = await bcrypt.hash(password, 12);
  const username = email.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'devuser';

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, username, displayName: 'Development User', passwordHash },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: memberRole.id } },
    update: {},
    create: { userId: user.id, roleId: memberRole.id },
  });
  console.log(`[seed] Ensured development user "${email}" (development-only).`);
}

async function main() {
  const permissionIdByKey = await seedPermissions();
  await seedRoles(permissionIdByKey);
  await seedDevUser();
  console.log(`[seed] Seeded ${ALL.length} permissions and ${Object.keys(ROLE_GRANTS).length} roles.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('[seed] Failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
