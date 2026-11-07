import { Component, inject } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideIonicAngular, IonApp } from '@ionic/angular';
import { HomePage } from './app/home/home.page';
import { AuthPage } from './app/auth/auth.page';
import { AuthService } from './app/data/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, HomePage, AuthPage],
  template: '<ion-app>@if (auth.user()) { <app-home /> } @else { <app-auth /> }</ion-app>',
})
class AppComponent { readonly auth = inject(AuthService); }

bootstrapApplication(AppComponent, {
  providers: [provideIonicAngular({ mode: 'md' })],
}).catch((error) => console.error(error));
