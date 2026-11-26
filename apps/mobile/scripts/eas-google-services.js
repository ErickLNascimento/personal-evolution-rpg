// Hook do EAS (eas-build-pre-install): copia o google-services.json da variável de arquivo
// GOOGLE_SERVICES_JSON (secreta no EAS) para o caminho do app.json. Localmente o arquivo já existe.
const fs = require('fs');
const path = require('path');

const src = process.env.GOOGLE_SERVICES_JSON;
// O EAS roda o hook na pasta do app (apps/mobile).
const dest = path.resolve(process.cwd(), 'google-services.json');
if (src && fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log('google-services.json copiado do EAS');
} else if (!fs.existsSync(dest)) {
  console.warn('GOOGLE_SERVICES_JSON ausente: build Android sem push');
}
