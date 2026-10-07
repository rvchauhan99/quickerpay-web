import type { MetadataRoute } from 'next'

/** Allow crawl so Google can read the site-wide noindex tag. Do not Disallow. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
  }
}
