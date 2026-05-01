import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Howl } from 'howler';
import {
  IonContent,
  IonIcon,
  IonButton,
  IonRange,
  IonFooter
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
  logoYoutube,
  musicalNotes,
  globe,
} from 'ionicons/icons';
import { HttpClient } from '@angular/common/http';
import { NativeHttpService } from '../services/native-http.service';
import { environment } from '../../environments/environment';
import { interval, Subscription } from 'rxjs';
// Native playback handled via RadioService; Howler used for web
import { Capacitor } from '@capacitor/core';
import { RadioService } from '../services/radio.service';
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
    IonFooter
  ],
  providers: [],
})
export class ExploreContainerComponent implements OnInit, OnDestroy {
  @Input() name?: string;

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

  isNativePlatform = Capacitor.getPlatform() !== 'web';

  private readonly equalizerConfig = {
    barCount: this.isNativePlatform ? 35 : 70,
    minHeight: 30,
    maxHeight: 95,
    minDelay: 0.1,
    maxDelay: 0.9,
  };

  hzBars = this.createHzBars();

  private webHowl: Howl | null = null; // navegador (web)
  private metadataSubscription?: Subscription;
  private metadataInterval = 30000; // Actualizar cada 10 segundos

  private createHzBars() {
    const {
      barCount,
      minHeight,
      maxHeight,
      minDelay,
      maxDelay,
    } = this.equalizerConfig;

    return Array.from({ length: barCount }, (_, index) => {
      const heightFactor = (Math.sin(index * 1.7) + 1) / 2;
      const delayFactor = (Math.sin(index * 2.3 + 1) + 1) / 2;
      const height = Math.round(minHeight + heightFactor * (maxHeight - minHeight));
      const delay = (minDelay + delayFactor * (maxDelay - minDelay)).toFixed(1);

      return {
        height: `${height}%`,
        delay: `${delay}s`,
      };
    });
  }

  // URL del streaming de la emisora
  streamUrl = 'https://sp1.hostingclouds.net/8006/stream';
  metadataUrl = `${environment.apiUrl}/8006/stats`;
  nativeMetadataUrl = 'https://sp1.hostingclouds.net/8006/stats';

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

  public get showVolumeControl(): boolean {
    return false;
  }

  constructor(
    private nativeHttp: NativeHttpService,
    private radio: RadioService,
    private http: HttpClient
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
      globe
    });
  }

  ngOnInit() {}

  ngOnDestroy() {
    // Limpiar suscripciones y detener el reproductor
    this.stopMetadataPolling();
    if (this.isNativePlatform) {
      this.radio.stopAndRelease();
    } else {
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
    if (this.isNativePlatform) {
      // ANDROID / IOS
      this.nativeHttp
        .get<string>(this.nativeMetadataUrl, { responseType: 'text' })
        .subscribe({
          next: (xmlData) => this.parseXMLMetadata(xmlData),
          error: (error) =>
            console.log('Error obteniendo metadatos (native/http):', error),
        });
    } else {
      // WEB NORMAL (HttpClient)
      this.http
        .get(this.metadataUrl, { responseType: 'text' })
        .subscribe({
          next: (xmlData) => this.parseXMLMetadata(xmlData),
          error: (error) =>
            console.log('Error obteniendo metadatos (web/http):', error),
        });
    }
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

  // Native playback is delegated to RadioService

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
      this.radio.play();
      this.isPlaying = true;
      this.startMetadataPolling();
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
      this.radio.pause();
      this.isPlaying = false;
      this.stopMetadataPolling();
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

  // Background handling moved into RadioService
  onVolumeChange(event: any) {
    this.volume = event.detail.value;
    if (this.isNativePlatform) {
      this.radio.setVolume(this.volume);
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
