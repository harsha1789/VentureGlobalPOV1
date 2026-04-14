import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [AuthService],
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return false for isAuthenticated when no session', () => {
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('should login successfully with valid credentials', async () => {
    const result = await service.login({ username: 'harsha', password: 'test' });
    expect(result.success).toBeTrue();
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('should set currentUser signal on successful login', async () => {
    await service.login({ username: 'harsha', password: 'test' });
    expect(service.currentUser()?.displayName).toBe('Harsha');
    expect(service.currentUser()?.initials).toBe('HA');
  });

  it('should reject invalid credentials', async () => {
    const result = await service.login({ username: 'wrong', password: 'wrong' });
    expect(result.success).toBeFalse();
    expect(result.error).toContain('Invalid');
  });

  it('should clear user on logout', async () => {
    await service.login({ username: 'harsha', password: 'test' });
    service.logout();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentUser()).toBeNull();
  });

  it('should be case-insensitive for username', async () => {
    const result = await service.login({ username: 'HARSHA', password: 'test' });
    expect(result.success).toBeTrue();
  });
});
