export type DemoRole = 'admin' | 'manager' | 'viewer';

export type DemoPermission =
  | 'employee:read'
  | 'employee:create'
  | 'employee:update'
  | 'employee:delete'
  | 'employee:import'
  | 'employee:export'
  | 'employee:bulk-create'
  | 'file:upload'
  | 'health:read'
  | 'sync:run'
  | 'sync:schedule';

export type DemoAccessToken = {
  roles: DemoRole[];
  permissions: DemoPermission[];
};