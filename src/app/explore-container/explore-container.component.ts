import { Component, Input } from '@angular/core';
import { Howl } from 'howler';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
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
} from 'ionicons/icons';

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
})
export class ExploreContainerComponent {
  @Input() name?: string;

  private player: Howl | null = null;
  isPlaying = false;
  volume = 80; // Volumen inicial al 80%

  // Información de la emisora
  stationInfo = {
    name: 'Undeco RadiOnline',
    tagline: 'Tu emisora de confianza',
    logo: 'assets/images/UNDECO_Radio_logo.png'
  };

  // URL del streaming de la emisora
  streamUrl = 'https://sp1.hostingclouds.net/8006/stream';

  // URLs de redes sociales
  socialLinks = {
    facebook: 'https://www.facebook.com/Gabomanjarres',
    instagram: 'https://www.instagram.com/gabrielmanja/',
    whatsapp: 'https://wa.me/+573003819645',
    tiktok: 'https://www.tiktok.com',
  };

  constructor() {
    // Registrar los iconos necesarios
    addIcons({
      play,
      pause,
      logoFacebook,
      logoInstagram,
      logoWhatsapp,
      logoTiktok,
      volumeLow,
      volumeHigh,
    });
  }

  play() {
    if (!this.player) {
      this.player = new Howl({
        src: [this.streamUrl],
        html5: true,
        format: ['mp3', 'aac'],
        volume: this.volume / 100, // Configurar volumen inicial
        onplay: () => (this.isPlaying = true),
        onend: () => console.log('Stream finalizado'),
        onpause: () => (this.isPlaying = false),
        onloaderror: (id: any, error: any) => {
          console.error('Error cargando stream:', error);
          this.isPlaying = false;
        },
        onplayerror: (id: any, error: any) => {
          console.error('Error reproduciendo stream:', error);
          this.isPlaying = false;
        },
      });
    }

    this.player.play();
  }

  pause() {
    if (this.player) {
      this.player.pause();
      this.isPlaying = false;
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

  openSocial(platform: string) {
    const url = this.socialLinks[platform as keyof typeof this.socialLinks];
    if (url) {
      window.open(url, '_blank');
    }
  }
}
