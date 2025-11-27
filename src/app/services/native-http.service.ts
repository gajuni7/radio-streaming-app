import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { Http as CapacitorHttp } from '@capacitor-community/http';

export interface NativeHttpOptions {
  headers?: HttpHeaders | { [key: string]: string };
  params?: HttpParams | { [key: string]: any };
  responseType?: 'json' | 'text';
}

@Injectable({ providedIn: 'root' })
export class NativeHttpService {
  private readonly isNative = Capacitor.isNativePlatform ? Capacitor.isNativePlatform() : (Capacitor.getPlatform() !== 'web');

  constructor(private http: HttpClient) {}

  get<T = any>(url: string, options: NativeHttpOptions = {}): Observable<T> {
    const { headers, params, responseType = 'json' } = options;

    if (!this.isNative) {
      // Web: delegate to Angular HttpClient
      return this.http.get<T>(url, {
        headers: headers instanceof HttpHeaders ? headers : new HttpHeaders(headers || {}),
        params: params instanceof HttpParams ? params : new HttpParams({ fromObject: (params || {}) as any }),
        responseType: responseType as any
      });
    }

    // Native: use Capacitor HTTP plugin
    return from(CapacitorHttp.get({
      url,
      headers: headers && !(headers instanceof HttpHeaders) ? headers : {},
      params: params && !(params instanceof HttpParams) ? params : {}
    })).pipe(
      map(result => {
        // If text requested but data is object, stringify
        if (responseType === 'text') {
          return (typeof result.data === 'string' ? result.data : JSON.stringify(result.data)) as any as T;
        }
        return result.data as T;
      })
    );
  }
}
