import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'vg-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  username  = '';
  password  = '';
  loading   = signal(false);
  errorMsg  = signal('');

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isAuthenticated()) this.router.navigate(['/dashboard']);
  }

  async onSubmit(): Promise<void> {
    this.errorMsg.set('');
    if (!this.username || !this.password) {
      this.errorMsg.set('Please enter both username and password.');
      return;
    }
    this.loading.set(true);
    const result = await this.auth.login({ username: this.username, password: this.password });
    this.loading.set(false);
    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMsg.set(result.error || 'Login failed.');
      this.password = '';
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.onSubmit();
  }
}
