import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { AuthService } from '../data/auth.service';

@Component({
  selector: 'app-auth', standalone: true, imports: [FormsModule, IonContent],
  templateUrl: './auth.page.html', styleUrl: './auth.page.scss',
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  readonly registering = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  email = '';
  password = '';

  toggleMode(): void { this.registering.update((value) => !value); this.error.set(''); }

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.registering()) await this.auth.register(this.email, this.password);
      else await this.auth.signIn(this.email, this.password);
    } catch (error) { this.error.set((error as Error).message); }
    finally { this.busy.set(false); }
  }
}
