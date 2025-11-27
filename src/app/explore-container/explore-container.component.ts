import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Howl } from 'howler';
import {
  IonContent,
  IonIcon,
  IonButton,
  IonRange,
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  play,
  pause,
  logoFacebook,
  logoInstagram,
  logoWhatsapp,
  logoTiktok,
  volumeLow,
  volumeHigh,
  videocam,
  globe,
  logoYoutube,
  musicalNote,
  musicalNotes,
} from 'ionicons/icons';
import { HttpClient } from '@angular/common/http';
import { NativeHttpService } from '../services/native-http.service';
import { environment } from '../../environments/environment';
import { interval, Subscription } from 'rxjs';
import { Media, MediaObject } from '@awesome-cordova-plugins/media/ngx';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { Capacitor } from '@capacitor/core';
@Component({
  selector: 'app-explore-container',
  templateUrl: './explore-container.component.html',
  styleUrls: ['./explore-container.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonIcon,
    IonButton,
    IonRange,
  ],
  providers: [BackgroundMode, Media],
})
export class ExploreContainerComponent implements OnInit, OnDestroy {
  @Input() name?: string;

  private mediaObj: MediaObject | null = null; // nativo (Android/iOS)
  private webHowl: Howl | null = null; // navegador (web)
  private metadataSubscription?: Subscription;
  private metadataInterval = 30000; // Actualizar cada 10 segundos

  isPlaying = false;
  volume = 80; // Volumen inicial al 80%

  // Metadatos del stream
  currentSong = {
    title: 'Cargando',
    artist: '',
    album: '',
  };

  // Información de la emisora
  stationInfo = {
    name: 'Undeco RadiOnline',
    tagline: 'Tu emisora de confianza',
    logo: 'assets/images/UNDECO_Radio_logo.png',
  };

  private isNativePlatform = Capacitor.getPlatform() !== 'web';

  // URL del streaming de la emisora
  streamUrl = 'https://sp1.hostingclouds.net/8006/stream';
  metadataUrl = `${environment.apiUrl}/8006/stats`;

  // URLs de redes sociales
  socialLinks = {
    facebook: 'https://www.facebook.com/undecobq',
    instagram: 'https://www.instagram.com/undecobaq/',
    whatsapp: 'https://api.whatsapp.com/send?phone=+57 3245048035',
    tiktok: 'https://www.tiktok.com/@undecobaq',
    homepage: 'https://undeco.co/',
    youtube: 'https://www.youtube.com/@undecoradio',
  };

  public get showStatus(): boolean {
    // Ocultar el indicador de estado temporalmente
    return false;
  }

  constructor(
    private http: HttpClient,
    private nativeHttp: NativeHttpService,
    private backgroundMode: BackgroundMode,
    // android permissions removed
    private media: Media
  ) {
    // Registrar los iconos necesarios
    addIcons({
      play,
      pause,
      logoFacebook,
      logoInstagram,
      logoWhatsapp,
      logoTiktok,
      logoYoutube,
      musicalNotes,
      volumeLow,
      volumeHigh,
      videocam,
      globe,
    });
  }

  ngOnInit() {
    console.log('ORIGIN REAL:', location.origin);
    console.log('ES NATIVO:', Capacitor.isNativePlatform());
  }

  ngOnDestroy() {
    // Limpiar suscripciones y detener el reproductor
    this.stopMetadataPolling();
    if (this.mediaObj) {
      try {
        this.mediaObj.stop();
      } catch {}
      try {
        this.mediaObj.release();
      } catch {}
      this.mediaObj = null;
    }
    if (this.webHowl) {
      try {
        this.webHowl.stop();
      } catch {}
      try {
        this.webHowl.unload();
      } catch {}
      this.webHowl = null;
    }
  }

  startMetadataPolling() {
    // Obtener metadatos inmediatamente
    this.fetchMetadata();

    // Configurar actualización automática de metadatos
    this.metadataSubscription = interval(this.metadataInterval).subscribe(
      () => {
        this.fetchMetadata();
      }
    );
  }

  stopMetadataPolling() {
    if (this.metadataSubscription) {
      this.metadataSubscription.unsubscribe();
      this.metadataSubscription = undefined;
    }
  }

  fetchMetadata() {
    this.nativeHttp.get<string>(this.metadataUrl, { responseType: 'text' }).subscribe({
      next: (xmlData) => this.parseXMLMetadata(xmlData),
      error: (error) => console.log('Error obteniendo metadatos (native/http):', error)
    });
  }

  parseXMLMetadata(xmlString: string) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Obtener el título de la canción
      const songTitleElement = xmlDoc.getElementsByTagName('SONGTITLE')[0];
      const songTitle = songTitleElement?.textContent?.trim() || '';

      // Obtener otros datos útiles
      const serverTitle =
        xmlDoc.getElementsByTagName('SERVERTITLE')[0]?.textContent || '';
      const currentListeners =
        xmlDoc.getElementsByTagName('CURRENTLISTENERS')[0]?.textContent || '0';
      const bitrate =
        xmlDoc.getElementsByTagName('BITRATE')[0]?.textContent || '';

      console.log('Servidor:', serverTitle);
      console.log('Oyentes:', currentListeners);
      console.log('Bitrate:', bitrate);

      if (songTitle) {
        this.parseSongTitle(songTitle);
      }
    } catch (error) {
      console.log('Error parseando XML:', error);
    }
  }

  parseSongTitle(songTitle: string) {
    // Parsear el título de la canción
    // Formato común: "Artista - Título" o "Título"
    if (songTitle.includes(' - ')) {
      const parts = songTitle.split(' - ');
      this.currentSong = {
        artist: parts[0].trim(),
        title: parts[1].trim(),
        album: '',
      };
    } else {
      this.currentSong = {
        artist: '',
        title: songTitle.trim(),
        album: '',
      };
    }
  }

  private createMediaIfNeeded() {
    if (!this.mediaObj) {
      if (this.isNativePlatform) {
        this.mediaObj = this.media.create(this.streamUrl);
        this.mediaObj.onError.subscribe((err) => {
          console.log('Media error:', err);
        });
        this.mediaObj.onStatusUpdate.subscribe((status) => {
          // 1: starting, 2: running, 3: paused, 4: stopped
          console.log('Media status:', status);
        });
        try {
          this.mediaObj.setVolume(this.volume / 100);
        } catch {}
      } else {
        console.warn('Media plugin only works on device (native).');
      }
    }
  }

  private createWebHowlIfNeeded() {
    if (!this.webHowl) {
      this.webHowl = new Howl({
        src: [this.streamUrl],
        html5: true,
        format: ['mp3', 'aac'],
        volume: this.volume / 100,
        onplay: () => {
          this.isPlaying = true;
          this.startMetadataPolling();
        },
        onpause: () => {
          this.isPlaying = false;
          this.stopMetadataPolling();
        },
        onend: () => {
          this.isPlaying = false;
          this.stopMetadataPolling();
        },
        onloaderror: (_id, error) => {
          console.log('Web Howl load error:', error);
          this.isPlaying = false;
        },
        onplayerror: (_id, error) => {
          console.log('Web Howl play error:', error);
          this.isPlaying = false;
        },
      });
    }
  }

  play() {
    if (this.isNativePlatform) {
      this.createMediaIfNeeded();
      if (!this.mediaObj) {
        return;
      }
      try {
        this.mediaObj.play();
        this.isPlaying = true;
        this.startMetadataPolling();
      } catch (error) {
        console.log('Error reproduciendo stream (native):', error);
        this.isPlaying = false;
      }
    } else {
      this.createWebHowlIfNeeded();
      try {
        this.webHowl?.play();
        // onplay callback sets flags
      } catch (error) {
        console.log('Error reproduciendo stream (web):', error);
        this.isPlaying = false;
      }
    }
  }

  pause() {
    if (this.isNativePlatform) {
      if (this.mediaObj) {
        try {
          this.mediaObj.pause();
        } catch {}
        this.isPlaying = false;
        this.stopMetadataPolling();
      }
    } else {
      if (this.webHowl) {
        try {
          this.webHowl.pause();
        } catch {}
        this.isPlaying = false;
        this.stopMetadataPolling();
      }
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  onVolumeChange(event: any) {
    this.volume = event.detail.value;
    if (this.isNativePlatform) {
      if (this.mediaObj) {
        try {
          this.mediaObj.setVolume(this.volume / 100);
        } catch {}
      }
    } else {
      if (this.webHowl) {
        try {
          this.webHowl.volume(this.volume / 100);
        } catch {}
      }
    }
  }

  // Reproductor nativo via cordova-plugin-media

  openSocial(platform: string) {
    const url = this.socialLinks[platform as keyof typeof this.socialLinks];
    if (url) {
      window.open(url, '_blank');
    }
  }
}
