import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Preset, PresetDetail, Sound } from '../models/preset.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PresetService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getPresets(): Observable<Preset[]> {
    return this.http.get<Preset[]>(`${this.apiUrl}/presets`);
  }

  getPresetSounds(category: string): Observable<PresetDetail> {
    return this.http.get<PresetDetail>(`${this.apiUrl}/presets/${encodeURIComponent(category)}`);
  }

  renamePreset(oldName: string, newName: string): Observable<{ success: boolean; oldName: string; newName: string }> {
    return this.http.put<{ success: boolean; oldName: string; newName: string }>(
      `${this.apiUrl}/presets/${encodeURIComponent(oldName)}`,
      { name: newName }
    );
  }

  createPreset(name: string): Observable<{ success: boolean; preset: Preset }> {
    return this.http.post<{ success: boolean; preset: Preset }>(
      `${this.apiUrl}/presets`,
      { name }
    );
  }

  deletePreset(category: string): Observable<{ success: boolean; deleted: string }> {
    return this.http.delete<{ success: boolean; deleted: string }>(
      `${this.apiUrl}/presets/${encodeURIComponent(category)}`
    );
  }

  addSound(category: string, url: string, name?: string): Observable<{ success: boolean; sound: Sound }> {
    return this.http.post<{ success: boolean; sound: Sound }>(
      `${this.apiUrl}/presets/${encodeURIComponent(category)}/sounds`,
      { url, name }
    );
  }

  deleteSound(category: string, filename: string): Observable<{ success: boolean; deleted: string }> {
    return this.http.delete<{ success: boolean; deleted: string }>(
      `${this.apiUrl}/presets/${encodeURIComponent(category)}/sounds/${encodeURIComponent(filename)}`
    );
  }

  uploadSound(category: string, file: File): Observable<{ success: boolean; sound: Sound }> {
    const formData = new FormData();
    formData.append('audio', file);
    return this.http.post<{ success: boolean; sound: Sound }>(
      `${this.apiUrl}/presets/${encodeURIComponent(category)}/sounds/upload`,
      formData
    );
  }
}
