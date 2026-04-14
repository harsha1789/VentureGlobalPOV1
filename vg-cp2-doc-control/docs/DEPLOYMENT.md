# Deployment Guide

## Local Development

```bash
git clone <repo>
cd vg-cp2-doc-control
npm install
npm start
# → http://localhost:4200
```

---

## Azure Static Web Apps (Recommended)

VGL is already on Azure. Azure Static Web Apps is the zero-infrastructure deployment option.

### Prerequisites
- Azure subscription (VGL existing)
- Azure CLI installed
- GitHub repository for the project

### Deploy

```bash
# Build production bundle
npm run build:prod

# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist/vg-cp2-doc-control \
  --app-name vg-cp2-doc-control \
  --resource-group vgl-cp2-rg \
  --location eastus
```

### GitHub Actions (CI/CD)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure Static Web Apps

on:
  push:
    branches: [main]

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build:prod
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: /
          output_location: dist/vg-cp2-doc-control
```

---

## Environment Configuration

```typescript
// src/environments/environment.ts (development)
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  azureDocIntelligenceEndpoint: '',  // Phase 2
  sdxApiBaseUrl: '',                  // Phase 3
};

// src/environments/environment.production.ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://vg-cp2-api.azurewebsites.net',
  azureDocIntelligenceEndpoint: 'https://vg-cp2-doc-intel.cognitiveservices.azure.com',
  sdxApiBaseUrl: 'https://sdx.vgl-cp2.com/api',
};
```

---

## Azure Services Required (Phase 2 onwards)

| Service | Purpose | SKU |
|---|---|---|
| Azure Static Web Apps | Host Angular app | Free tier |
| Azure Document Intelligence | Arbitrary layout extraction, OCR | S0 — pay per page |
| Azure OpenAI | Vision LLM for template validity | Consumption |
| Azure Functions | Backend API proxy (CORS) | Consumption plan |
| Azure Key Vault | Store API keys and SDx credentials | Standard |

---

## Security Notes

1. **SDx API credentials** must be stored in Azure Key Vault — never in source code or environment files committed to git.
2. **Azure AD authentication** should replace the demo username/password before any production use.
3. **CORS** — the Angular app cannot call SDx or Azure APIs directly from the browser in production. All external API calls must go through an Azure Functions proxy.
4. **Document content** — uploaded documents contain project-confidential information. Ensure Azure Document Intelligence is configured in the same Azure region as VGL's data residency requirement (Azure North Central US for VGL).

---

*DP World Architecture · VGL CP2 LNG · April 2026*
