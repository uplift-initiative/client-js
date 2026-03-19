import { HttpClient } from './http';
import type { PhraseReplacement, PhraseReplacementConfig } from './types';

export class PhraseReplacements {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async create(replacements: PhraseReplacement[]): Promise<PhraseReplacementConfig> {
    const { data } = await this.http.postJSON<PhraseReplacementConfig>(
      '/v1/synthesis/phrase-replacement-config',
      { phraseReplacements: replacements },
    );
    return data;
  }

  async get(configId: string): Promise<PhraseReplacementConfig> {
    const { data } = await this.http.get<PhraseReplacementConfig>(
      `/v1/synthesis/phrase-replacement-config/${configId}`,
    );
    return data;
  }

  async list(): Promise<PhraseReplacementConfig[]> {
    const { data } = await this.http.get<PhraseReplacementConfig[]>(
      '/v1/synthesis/phrase-replacement-config',
    );
    return data;
  }

  async update(configId: string, replacements: PhraseReplacement[]): Promise<PhraseReplacementConfig> {
    const { data } = await this.http.postJSON<PhraseReplacementConfig>(
      `/v1/synthesis/phrase-replacement-config/${configId}`,
      { phraseReplacements: replacements },
    );
    return data;
  }
}
