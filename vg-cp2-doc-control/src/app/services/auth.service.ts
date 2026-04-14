import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { User, LoginCredentials, UserRole, RolePermissions, ROLE_PERMISSIONS } from '../models';

const USERS: Record<string, { password: string; displayName: string; role: UserRole; organisation?: string; contract?: string }> = {
  harsha:    { password: 'test',    displayName: 'Harsha',          role: 'document_controller', organisation: 'VGL', contract: 'C2 EPC-BOP' },
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly SESSION_KEY = 'vg_cp2_session';

  currentUser = signal<User | null>(this.loadSession());

  // Computed permissions based on current user's role
  permissions = computed<RolePermissions>(() => {
    const user = this.currentUser();
    if (!user) {
      return {
        canUploadFiles: false, canClaimDocuments: false, canApproveReject: false,
        canViewAllProjects: false, canManageUsers: false, canExportAudit: false, canConfigureDistribution: false,
      };
    }
    return ROLE_PERMISSIONS[user.role];
  });

  constructor(private router: Router) {}

  async login(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
    await this.simulateDelay(900);
    const record = USERS[credentials.username.toLowerCase()];
    if (!record || record.password !== credentials.password) {
      return { success: false, error: 'Invalid username or password.' };
    }
    const user: User = {
      username:     credentials.username.toLowerCase(),
      displayName:  record.displayName,
      role:         record.role,
      initials:     record.displayName.substring(0, 2).toUpperCase(),
      organisation: record.organisation,
      contract:     record.contract,
    };
    this.saveSession(user);
    this.currentUser.set(user);
    return { success: true };
  }

  logout(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  hasPermission(permission: keyof RolePermissions): boolean {
    return this.permissions()[permission];
  }

  hasRole(role: UserRole): boolean {
    return this.currentUser()?.role === role;
  }

  hasAnyRole(...roles: UserRole[]): boolean {
    const userRole = this.currentUser()?.role;
    return userRole ? roles.includes(userRole) : false;
  }

  getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      admin: 'Administrator',
      document_controller: 'Document Controller',
      reviewer: 'Reviewer',
      viewer: 'Viewer',
      contractor_readonly: 'Contractor (Read Only)',
    };
    return labels[role];
  }

  private saveSession(user: User): void {
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
  }

  private loadSession(): User | null {
    const raw = sessionStorage.getItem(this.SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
