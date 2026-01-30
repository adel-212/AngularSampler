import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PresetService } from '../../services/preset.service';
import { Preset } from '../../models/preset.model';
import { PresetDetailComponent } from '../preset-detail/preset-detail.component';

@Component({
  selector: 'app-preset-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PresetDetailComponent],
  templateUrl: './preset-list.component.html',
  styleUrl: './preset-list.component.css'
})
export class PresetListComponent implements OnInit {
  private presetService = inject(PresetService);

  presets = signal<Preset[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // État pour l'édition
  editingCategory = signal<string | null>(null);
  editName = signal('');
  saving = signal(false);

  // État pour la création
  showCreateForm = signal(false);
  newPresetName = signal('');
  creating = signal(false);

  // État pour la suppression
  deletingCategory = signal<string | null>(null);

  // État pour le détail (modal)
  selectedPreset = signal<Preset | null>(null);

  ngOnInit(): void {
    this.loadPresets();
  }

  loadPresets(): void {
    this.loading.set(true);
    this.error.set(null);

    this.presetService.getPresets().subscribe({
      next: (data) => {
        this.presets.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur chargement presets:', err);
        this.error.set('Impossible de charger les presets. Vérifiez que le serveur est démarré.');
        this.loading.set(false);
      }
    });
  }

  startEdit(preset: Preset): void {
    this.editingCategory.set(preset.category);
    this.editName.set(preset.name);
  }

  cancelEdit(): void {
    this.editingCategory.set(null);
    this.editName.set('');
  }

  saveEdit(preset: Preset): void {
    const newName = this.editName().trim();
    if (!newName || newName === preset.name) {
      this.cancelEdit();
      return;
    }

    this.saving.set(true);

    this.presetService.renamePreset(preset.category, newName).subscribe({
      next: (result) => {
        // Mettre à jour la liste localement
        const updated = this.presets().map(p =>
          p.category === preset.category
            ? { ...p, category: result.newName, name: result.newName }
            : p
        );
        this.presets.set(updated);
        this.cancelEdit();
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Erreur renommage:', err);
        alert(err.error?.error || 'Erreur lors du renommage');
        this.saving.set(false);
      }
    });
  }

  // --- Création ---
  openCreateForm(): void {
    this.showCreateForm.set(true);
    this.newPresetName.set('');
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
    this.newPresetName.set('');
  }

  createPreset(): void {
    const name = this.newPresetName().trim();
    if (!name) {
      return;
    }

    this.creating.set(true);

    this.presetService.createPreset(name).subscribe({
      next: (result) => {
        // Ajouter le nouveau preset à la liste
        this.presets.set([...this.presets(), result.preset]);
        this.cancelCreate();
        this.creating.set(false);
      },
      error: (err) => {
        console.error('Erreur création:', err);
        alert(err.error?.error || 'Erreur lors de la création');
        this.creating.set(false);
      }
    });
  }

  // --- Suppression ---
  confirmDelete(preset: Preset): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le preset "${preset.name}" ?\nCette action est irréversible et supprimera tous les sons associés.`)) {
      this.deletePreset(preset);
    }
  }

  deletePreset(preset: Preset): void {
    this.deletingCategory.set(preset.category);

    this.presetService.deletePreset(preset.category).subscribe({
      next: () => {
        // Retirer le preset de la liste
        this.presets.set(this.presets().filter(p => p.category !== preset.category));
        this.deletingCategory.set(null);
      },
      error: (err) => {
        console.error('Erreur suppression:', err);
        alert(err.error?.error || 'Erreur lors de la suppression');
        this.deletingCategory.set(null);
      }
    });
  }

  // --- Détail du preset (modal) ---
  openDetail(preset: Preset, event: Event): void {
    event.stopPropagation();
    this.selectedPreset.set(preset);
  }

  closeDetail(): void {
    this.selectedPreset.set(null);
  }

  onDetailUpdated(): void {
    // Recharger les presets pour mettre à jour les compteurs
    this.loadPresets();
  }
}
