import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { interval, Subscription } from 'rxjs';
import { Media, MediaObject } from '@awesome-cordova-plugins/media/ngx';
import { NativeHttpService } from './native-http.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RadioService {
  private isNative = Capacitor.getPlatform() !== 'web';
  private deviceReady = false;
  private backgroundDefaults = {
    title: 'Undeco Radio',
    text: 'Reproduciendo',
    bigText: false,
    resume: true,
    hidden: false,
    icon: 'ic_launcher', // nombre del recurso mipmap por defecto
    color: 'ffffff'
  };

  private mediaObj: MediaObject | null = null;
  private volume = 0.8; // 0..1
  private isPlaying = false;

  private metadataIntervalMs = 30000;
  private metadataTimer?: Subscription;

  public currentSong = {
    title: 'Cargando',
    artist: '',
    album: '',
  };

  readonly streamUrl = 'https://sp1.hostingclouds.net/8006/stream';
  readonly metadataUrl = `${environment.apiUrl}/8006/stats`;
  readonly nativeMetadataUrl = 'https://sp1.hostingclouds.net/8006/stats';

  constructor(
    private media: Media,
    private http: NativeHttpService
  ) {
    if (this.isNative) {
      document.addEventListener('deviceready', () => {
        this.deviceReady = true;
        this.requestNotificationPermission();
        this.initBackgroundMode();
      }, { once: true });
    }
  }

  private initBackgroundMode() {
    const bg = (window as any).cordova?.plugins?.backgroundMode;
    if (!bg) {
      console.log('[RadioService] backgroundMode plugin no disponible');
      return;
    }
    try {
      bg.setDefaults(this.backgroundDefaults);
    } catch (e) {
      console.log('[RadioService] setDefaults fallo', e);
    }
  }

  private requestNotificationPermission() {
    // Android 13+ (API 33) requires POST_NOTIFICATIONS runtime permission
    try {
      const apiLevel = (window as any).cordova?.platformId === 'android'
        ? (window as any).cordova?.plugins?.device?.sdkVersion || 0
        : 0;
    } catch {}
    const permissions = (window as any).cordova?.plugins?.permissions;
    if (!permissions || !(permissions as any).POST_NOTIFICATIONS) return;
    permissions.checkPermission(permissions.POST_NOTIFICATIONS, (status: any) => {
      if (!status.hasPermission) {
        permissions.requestPermission(permissions.POST_NOTIFICATIONS, () => {
          console.log('[RadioService] POST_NOTIFICATIONS concedido');
        }, (err: any) => {
          console.log('[RadioService] POST_NOTIFICATIONS denegado', err);
        });
      }
    }, (err: any) => console.log('[RadioService] check POST_NOTIFICATIONS error', err));
  }

  // Playback controls
  play() {
    if (!this.isNative) {
      console.log(
        'RadioService play(): Native-only. Implement web player separately.'
      );
      return;
    }
    this.ensureMedia();
    if (!this.mediaObj) return;
    try {
      this.mediaObj.play();
      this.isPlaying = true;
      this.applyVolume();
      this.startMetadataPolling();
      this.enableBackground('Reproduciendo');
    } catch (err) {
      console.error('RadioService play error:', err);
    }
  }

  pause() {
    if (!this.isNative) {
      console.log('RadioService pause(): Native-only.');
      return;
    }
    if (!this.mediaObj) return;
    try {
      this.mediaObj.pause();
      this.isPlaying = false;
      this.stopMetadataPolling();
      this.disableBackground();
    } catch (err) {
      console.error('RadioService pause error:', err);
    }
  }

  stopAndRelease() {
    if (!this.isNative) {
      console.log('RadioService stopAndRelease(): Native-only.');
      return;
    }
    try {
      this.mediaObj?.stop();
    } catch {}
    try {
      this.mediaObj?.release();
    } catch {}
    this.mediaObj = null;
    this.isPlaying = false;
    this.stopMetadataPolling();
    this.disableBackground();
  }

  setVolume(percent: number) {
    this.volume = Math.max(0, Math.min(1, (percent ?? 0) / 100));
    this.applyVolume();
  }

  private applyVolume() {
    if (this.mediaObj) {
      try {
        this.mediaObj.setVolume(this.volume);
      } catch {}
    }
  }

  // Metadata
  startMetadataPolling() {
    if (this.metadataTimer) return;
    this.fetchMetadata();
    this.metadataTimer = interval(this.metadataIntervalMs).subscribe(() =>
      this.fetchMetadata()
    );
  }

  stopMetadataPolling() {
    if (this.metadataTimer) {
      this.metadataTimer.unsubscribe();
      this.metadataTimer = undefined;
    }
  }

  private fetchMetadata() {
    const url = this.isNative ? this.nativeMetadataUrl : this.metadataUrl;
    this.http
      .get<string>(url, { responseType: 'text' })
      .subscribe({
        next: (xml) => this.parseXML(xml),
        error: (err) => console.log('RadioService metadata error:', err),
      });
  }

  private parseXML(xmlString: string) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      const songTitleElement = xmlDoc.getElementsByTagName('SONGTITLE')[0];
      const songTitle = songTitleElement?.textContent?.trim() || '';
      if (songTitle) {
        if (songTitle.includes(' - ')) {
          const [artist, title] = songTitle.split(' - ');
          this.currentSong = {
            artist: artist.trim(),
            title: title.trim(),
            album: '',
          };
        } else {
          this.currentSong = { artist: '', title: songTitle.trim(), album: '' };
        }
        this.updateBackgroundText();
      }
    } catch (err) {
      console.log('RadioService parseXML error:', err);
    }
  }

  // Background mode
  private enableBackground(statusText: string) {
    const bg = (window as any).cordova?.plugins?.backgroundMode;
    if (!bg || !this.isNative || !this.deviceReady) return;
    try {
      const defaults = { ...this.backgroundDefaults, text: statusText };
      bg.setDefaults(defaults);
      if (!bg.isEnabled()) bg.enable();
      bg.on('activate', () => {
        try { bg.disableBatteryOptimizations?.(); } catch {}
        try { bg.acquire?.(); } catch {}
      });
    } catch (err) {
      console.log('RadioService enableBackground error:', err);
    }
  }

  private disableBackground() {
    const bg = (window as any).cordova?.plugins?.backgroundMode;
    if (!bg || !this.isNative || !this.deviceReady) return;
    try {
      try { bg.release?.(); } catch {}
      if (bg.isEnabled()) bg.disable();
    } catch (err) {
      console.log('RadioService disableBackground error:', err);
    }
  }

  private updateBackgroundText() {
    const bg = (window as any).cordova?.plugins?.backgroundMode;
    if (!bg || !this.isNative || !this.deviceReady) return;
    try {
      const text = `${this.currentSong.artist ? this.currentSong.artist + ' - ' : ''}${this.currentSong.title || 'Reproduciendo'}`;
      const cfg = { ...this.backgroundDefaults, text };
      bg.configure(cfg);
    } catch {}
  }


  private ensureMedia() {
    if (!this.mediaObj && this.isNative) {
      this.mediaObj = this.media.create(this.streamUrl);
      this.mediaObj.onError.subscribe((err: any) =>
        console.error('Media error:', err)
      );
      this.mediaObj.onStatusUpdate.subscribe((status: any) => {
        // 1: starting, 2: running, 3: paused, 4: stopped
        // console.log('Media status:', status);
      });
    }
  }
}
