# OAuth Callback Redirect URL Fix - Deployment Guide

## Problem
When users try to sign in/sign up with GitHub (or other OAuth providers) on production at `https://corpsim.altitude-interactive.com`, they receive an error:

> "The redirect_uri is not associated with this application."

## Root Cause
The OAuth flow in better-auth works as follows:
1. User clicks "Continue with GitHub" on the web app
2. Browser sends request to API server (via `NEXT_PUBLIC_API_URL`)
3. API server redirects to GitHub with a `redirect_uri` parameter
4. The `redirect_uri` is constructed from `BETTER_AUTH_URL` environment variable
5. GitHub redirects back to that `redirect_uri` after user authorization
6. API server processes the callback

The issue occurs because:
- The GitHub OAuth App is configured to allow callbacks to `https://corpsim.altitude-interactive.com/api/auth/callback/github`
- But `BETTER_AUTH_URL` is set to `https://corpsim-api.altitude-interactive.com`
- This causes GitHub to reject the callback URL as unauthorized

## Solution
To fix this issue, we need to:

### 1. Update Nginx Configuration
Apply the updated `docs/project/corpsim.altitude.nginx.conf` to the production nginx server:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name corpsim.altitude-interactive.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Proxy Better Auth routes (/api/auth/*) to API server
    location /api/auth/ {
        proxy_pass http://192.0.2.10:4310;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://192.0.2.10:4311;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

This adds a specific proxy rule for `/api/auth/*` requests that forwards them to the API server. Replace the example IP addresses and SSL certificate paths with your production values.

### 2. Update API Service Environment Variable
In Dokploy (or your deployment platform), update the `corpsim-api` service environment variables:

Add:
```
BETTER_AUTH_URL=https://corpsim.altitude-interactive.com
```

This tells better-auth to construct OAuth callback URLs using the main web domain instead of the API subdomain.

### 3. Reload/Restart Services
1. Reload nginx configuration: `sudo nginx -s reload`
2. Restart the API service in Dokploy (or redeploy with the new environment variable)

### 4. Update OAuth Provider Configurations
Ensure the OAuth apps on each provider's developer portal have the correct callback URL registered:

**GitHub**: https://github.com/settings/developers
- Callback URL: `https://corpsim.altitude-interactive.com/api/auth/callback/github`

**Google**: https://console.cloud.google.com/apis/credentials
- Authorized redirect URI: `https://corpsim.altitude-interactive.com/api/auth/callback/google`

**Microsoft**: https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps
- Redirect URI: `https://corpsim.altitude-interactive.com/api/auth/callback/microsoft`

**Discord**: https://discord.com/developers/applications
- Redirect URI: `https://corpsim.altitude-interactive.com/api/auth/callback/discord`

## How It Works After the Fix
1. User clicks "Continue with GitHub" on `https://corpsim.altitude-interactive.com`
2. Browser calls `https://corpsim-api.altitude-interactive.com/api/auth/sign-in/social`
3. API server (with `BETTER_AUTH_URL=https://corpsim.altitude-interactive.com`) redirects to GitHub with `redirect_uri=https://corpsim.altitude-interactive.com/api/auth/callback/github`
4. User authorizes on GitHub
5. GitHub redirects to `https://corpsim.altitude-interactive.com/api/auth/callback/github`
6. Nginx proxies this request to the API server at port 4310
7. API server processes the callback and redirects to success page

## Testing
After applying the fix:
1. Go to `https://corpsim.altitude-interactive.com`
2. Navigate to `/sign-in` or `/sign-up`
3. Click "Continue with GitHub" (or another OAuth provider)
4. Verify you're redirected to the provider's authorization page
5. Authorize the application
6. Verify you're redirected back to the app successfully
7. Check browser network tab to confirm callbacks go to the correct domain

## Alternative Solution (Not Recommended)
Instead of updating nginx and environment variables, you could update each OAuth provider's configuration to allow callbacks to both domains:
- `https://corpsim.altitude-interactive.com/api/auth/callback/{provider}`
- `https://corpsim-api.altitude-interactive.com/api/auth/callback/{provider}`

However, this is not recommended because:
- It's confusing to have callbacks on two different domains
- It's harder to manage and update OAuth provider configurations
- Users might see inconsistent domain behavior
