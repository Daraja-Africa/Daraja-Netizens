export type AppRole = 'admin' | 'facilitator' | 'student' | 'participant' | 'host';

export type StaffRole = 'admin' | 'facilitator';

export type AppUser = { id: string; email?: string; role: AppRole; name?: string };

export function isStaffRole(role: AppRole | undefined): role is StaffRole {
  return role === 'admin' || role === 'facilitator';
}

/** Where a signed-in account lands: admins never see the facilitator dashboard first, and vice versa. */
export function homePathForRole(role: AppRole | undefined) {
  if (role === 'admin') return '/admin';
  if (role === 'facilitator') return '/facilitator';
  return '/student';
}

export function roleLabel(role: AppRole | undefined) {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'facilitator':
      return 'Facilitator';
    case 'student':
      return 'Training graduate';
    case 'participant':
      return 'Participant';
    case 'host':
      return 'Meeting host';
    default:
      return 'Staff';
  }
}
