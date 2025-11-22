/**
 * KeyAuth API Client for Discord Bot
 */

interface KeyAuthConfig {
  name: string
  ownerid: string
  version: string
  url: string
}

interface KeyAuthResponse {
  success: boolean
  message?: string
  info?: any
}

export class KeyAuthClient {
  private config: KeyAuthConfig
  private sessionId: string | null = null

  constructor() {
    this.config = {
      name: process.env.KEYAUTH_NAME || '',
      ownerid: process.env.KEYAUTH_OWNER_ID || '',
      version: process.env.KEYAUTH_VERSION || '2.0',
      url: process.env.KEYAUTH_URL || 'https://keyauth.win/api/1.3/',
    }

    if (!this.config.name || !this.config.ownerid) {
      throw new Error('KeyAuth configuration is missing. Please set KEYAUTH_NAME and KEYAUTH_OWNER_ID environment variables.')
    }
  }

  private async getSessionId(): Promise<string> {
    if (this.sessionId !== null) {
      return this.sessionId
    }

    try {
      const params = new URLSearchParams({
        type: 'init',
        ver: this.config.version,
        name: this.config.name,
        ownerid: this.config.ownerid,
      })

      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'KeyAuth-Discord-Bot/1.0',
        },
        body: params.toString(),
      })

      if (response.ok) {
        const data = await response.json() as { success?: boolean; sessionid?: string }
        if (data.success && data.sessionid) {
          this.sessionId = data.sessionid
          return this.sessionId
        }
      }
    } catch (error) {
      console.error('Failed to initialize session:', error)
    }

    // Fallback: generate a session ID
    const crypto = await import('crypto')
    const sessionId = crypto.randomUUID()
    this.sessionId = sessionId
    return sessionId
  }

  private async makeRequest(type: string, params: Record<string, string>): Promise<KeyAuthResponse> {
    const sessionId = await this.getSessionId()

    const requestParams = new URLSearchParams({
      type,
      sessionid: sessionId,
      name: this.config.name,
      ownerid: this.config.ownerid,
      ...params,
    })

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'KeyAuth-Discord-Bot/1.0',
        },
        body: requestParams.toString(),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json() as KeyAuthResponse
      return data
    } catch (error: any) {
      throw new Error(`KeyAuth API request failed: ${error.message}`)
    }
  }

  // User Management
  async getUserInfo(username: string): Promise<KeyAuthResponse> {
    return this.makeRequest('user', { username })
  }

  async banUser(username: string): Promise<KeyAuthResponse> {
    return this.makeRequest('ban', { username })
  }

  async unbanUser(username: string): Promise<KeyAuthResponse> {
    return this.makeRequest('unban', { username })
  }

  async deleteUser(username: string): Promise<KeyAuthResponse> {
    return this.makeRequest('deleteuser', { username })
  }

  async resetHWID(username: string): Promise<KeyAuthResponse> {
    return this.makeRequest('resetuser', { username })
  }

  // License Management
  async createLicense(license: string, days: number): Promise<KeyAuthResponse> {
    return this.makeRequest('add', { key: license, days: days.toString() })
  }

  async deleteLicense(license: string): Promise<KeyAuthResponse> {
    return this.makeRequest('delete', { key: license })
  }

  async useLicense(license: string, username: string): Promise<KeyAuthResponse> {
    return this.makeRequest('use', { key: license, username })
  }

  // Subscription Management
  async extendSubscription(username: string, subscription: string, days: number): Promise<KeyAuthResponse> {
    return this.makeRequest('extend', {
      username,
      subscription,
      days: days.toString(),
    })
  }

  // Statistics
  async getStats(): Promise<KeyAuthResponse> {
    return this.makeRequest('stats', {})
  }

  // Webhook Management
  async setWebhook(webhook: string): Promise<KeyAuthResponse> {
    return this.makeRequest('webhook', { webhook })
  }

  // Channel Management
  async addChannel(channel: string): Promise<KeyAuthResponse> {
    return this.makeRequest('addchannel', { channel })
  }

  async deleteChannel(channel: string): Promise<KeyAuthResponse> {
    return this.makeRequest('deletechannel', { channel })
  }
}

