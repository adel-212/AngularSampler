import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PresetListComponent } from './components/preset-list/preset-list.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PresetListComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'Sampler Admin';
  backendUrl = environment.backendUrl;
}
