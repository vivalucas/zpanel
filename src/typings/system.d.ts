declare namespace System {
  interface SiteSetting {
    siteTitle: string
    siteIcon: string
    loginTitle: string
    loginSubtitle: string
    loginFooter: string
    customCss: string
    customJs: string
  }

  interface SiteSettingRequest extends SiteSetting {
    loginCaptcha: boolean
  }

  interface DockerContainer {
    id: string
    image: string
    command: string
    created: string
    status: string
    ports: string
    names: string
    state: string
  }

  interface DockerStats {
    ID: string
    CPUPerc?: string
    MemUsage?: string
    NetIO?: string
    [key: string]: string | undefined
  }
}
