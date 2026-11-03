import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideIonicAngular, IonApp } from '@ionic/angular';
import { HomePage } from './app/home/home.page';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, HomePage],
  template: '<ion-app><app-home /></ion-app>',
})
class AppComponent {}

bootstrapApplication(AppComponent, {
  providers: [provideIonicAngular({ mode: 'md' })],
}).catch((error) => console.error(error));
