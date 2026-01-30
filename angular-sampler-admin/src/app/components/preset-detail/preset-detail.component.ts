import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PresetService } from '../../services/preset.service';
import { Preset, Sound } from '../../models/preset.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-preset-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preset-detail.component.html',
  styleUrl: './preset-detail.component.css'
})
export class PresetDetailComponent implements OnInit {
  private presetService = inject(PresetService);

  backendUrl = environment.backendUrl;

  @Input() preset!: Preset;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  sounds = signal<Sound[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Formulaire d'ajout de son
  showAddForm = signal(false);
  addMode = signal<'url' | 'file'>('url');
  soundUrl = signal('');
  soundName = signal('');
  soundFile = signal<File | null>(null);
  adding = signal(false);

  // Suppression
  deletingSound = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSounds();
  }

  loadSounds(): void {
    this.loading.set(true);
    this.error.set(null);

    this.presetService.getPresetSounds(this.preset.category).subscribe({
      next: (data) => {
        this.sounds.set(data.sounds || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur chargement sons:', err);
        this.error.set('Impossible de charger les sons');
        this.loading.set(false);
      }
    });
  }

  openAddForm(): void {
    this.showAddForm.set(true);
    this.addMode.set('url');
    this.soundUrl.set('');
    this.soundName.set('');
    this.soundFile.set(null);
  }

  cancelAdd(): void {
    this.showAddForm.set(false);
    this.soundUrl.set('');
    this.soundName.set('');
    this.soundFile.set(null);
  }

  setAddMode(mode: 'url' | 'file'): void {
    this.addMode.set(mode);
    this.soundUrl.set('');
    this.soundFile.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.soundFile.set(input.files[0]);
    }
  }

  addSound(): void {
    if (this.addMode() === 'file') {
      this.uploadFile();
    } else {
      this.addSoundByUrl();
    }
  }

  addSoundByUrl(): void {
    const url = this.soundUrl().trim();
    if (!url) return;

    this.adding.set(true);
    const name = this.soundName().trim() || undefined;

    this.presetService.addSound(this.preset.category, url, name).subscribe({
      next: (result) => {
        this.sounds.set([...this.sounds(), result.sound]);
        this.cancelAdd();
        this.adding.set(false);
        this.updated.emit();
      },
      error: (err) => {
        console.error('Erreur ajout son:', err);
        alert(err.error?.error || "Erreur lors de l'ajout du son");
        this.adding.set(false);
      }
    });
  }

  uploadFile(): void {
    const file = this.soundFile();
    if (!file) return;

    this.adding.set(true);

    this.presetService.uploadSound(this.preset.category, file).subscribe({
      next: (result) => {
        this.sounds.set([...this.sounds(), result.sound]);
        this.cancelAdd();
        this.adding.set(false);
        this.updated.emit();
      },
      error: (err) => {
        console.error('Erreur upload son:', err);
        alert(err.error?.error || "Erreur lors de l'upload du son");
        this.adding.set(false);
      }
    });
  }

  confirmDeleteSound(sound: Sound): void {
    if (confirm(`Supprimer le son "${sound.name}" ?`)) {
      this.deleteSound(sound);
    }
  }

  deleteSound(sound: Sound): void {
    this.deletingSound.set(sound.name);

    this.presetService.deleteSound(this.preset.category, sound.name).subscribe({
      next: () => {
        this.sounds.set(this.sounds().filter(s => s.name !== sound.name));
        this.deletingSound.set(null);
        this.updated.emit();
      },
      error: (err) => {
        console.error('Erreur suppression son:', err);
        alert(err.error?.error || 'Erreur lors de la suppression');
        this.deletingSound.set(null);
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
