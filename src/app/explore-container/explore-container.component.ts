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
import { interval, Subscription } from 'rxjs';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { Capacitor } from '@capacitor/core';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
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
    IonRange
  ],
  providers: [BackgroundMode, AndroidPermissions],
})
export class ExploreContainerComponent implements OnInit, OnDestroy {
  @Input() name?: string;

  private player: Howl | null = null;
  private metadataSubscription?: Subscription;
  private metadataInterval = 30000; // Actualizar cada 10 segundos
  
  isPlaying = false;
  volume = 80; // Volumen inicial al 80%

  // Metadatos del stream
  currentSong = {
    title: 'Cargando',
    artist: '',
    album: ''
  };

  // Información de la emisora
  stationInfo = {
    name: 'Undeco RadiOnline',
    tagline: 'Tu emisora de confianza',
    logo: 'assets/images/UNDECO_Radio_logo.png'
  };

  private isNativePlatform = Capacitor.getPlatform() !== 'web';

  // URL del streaming de la emisora
  streamUrl = 'https://sp1.hostingclouds.net/8006/stream';
  metadataUrl = '/api/8006/stats';

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
    private backgroundMode: BackgroundMode,
    private androidPermissions: AndroidPermissions
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
  }

  ngOnDestroy() {
    // Limpiar suscripciones y detener el reproductor
    this.stopMetadataPolling();
    if (this.player) {
      this.player.unload();
    }
  }

  startMetadataPolling() {
    // Obtener metadatos inmediatamente
    this.fetchMetadata();
    
    // Configurar actualización automática de metadatos
    this.metadataSubscription = interval(this.metadataInterval).subscribe(() => {
      this.fetchMetadata();
    });
  }

  stopMetadataPolling() {
    if (this.metadataSubscription) {
      this.metadataSubscription.unsubscribe();
      this.metadataSubscription = undefined;
    }
  }

  fetchMetadata() {
    this.http.get(this.metadataUrl, { responseType: 'text' }).subscribe({
      next: (xmlData) => {
        this.parseXMLMetadata(xmlData);
      },
      error: (error) => {
        console.error('Error obteniendo metadatos:', error);
      }
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
      const serverTitle = xmlDoc.getElementsByTagName('SERVERTITLE')[0]?.textContent || '';
      const currentListeners = xmlDoc.getElementsByTagName('CURRENTLISTENERS')[0]?.textContent || '0';
      const bitrate = xmlDoc.getElementsByTagName('BITRATE')[0]?.textContent || '';
      
      console.log('Servidor:', serverTitle);
      console.log('Oyentes:', currentListeners);
      console.log('Bitrate:', bitrate);
      
      if (songTitle) {
        this.parseSongTitle(songTitle);
      }
    } catch (error) {
      console.error('Error parseando XML:', error);
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
        album: ''
      };
    } else {
      this.currentSong = {
        artist: '',
        title: songTitle.trim(),
        album: ''
      };
    }
  }

  private initPlayer() {
    this.player = new Howl({
      src: [this.streamUrl],
      html5: true,
      format: ['mp3', 'aac'],
      volume: this.volume / 100, // Configurar volumen inicial
      onplay: () => {
        this.isPlaying = true;
        this.startMetadataPolling(); // Iniciar obtención de metadatos
      },
      onend: () => console.log('Stream finalizado'),
      onpause: () => {
        this.isPlaying = false;
        this.stopMetadataPolling(); // Detener obtención de metadatos
      },
      onloaderror: (id: any, error: any) => {
        console.error('Error cargando stream:', error);
        this.isPlaying = false;
        this.stopMetadataPolling();
      },
      onplayerror: (id: any, error: any) => {
        console.error('Error reproduciendo stream:', error);
        this.isPlaying = false;
        this.stopMetadataPolling();
      },
    });
  }


  play() {
    if (!this.player) {
      this.initPlayer();
    }

    this.player?.play();
  }

  pause() {
    if (this.player) {
      this.player.pause();
      this.isPlaying = false;
      this.stopMetadataPolling(); // Detener obtención de metadatos
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
    if (this.player) {
      this.player.volume(this.volume / 100);
    }
  }

  // Native player removed; background playback disabled

  openSocial(platform: string) {
    const url = this.socialLinks[platform as keyof typeof this.socialLinks];
    if (url) {
      window.open(url, '_blank');
    }
  }
}
