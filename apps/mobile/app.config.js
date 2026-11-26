// Configuração dinâmica por cima do app.json.
//
// Build local no iPhone com o Apple ID grátis (Personal Team): rode com
// FREE_APPLE_TEAM=1 (ex.: FREE_APPLE_TEAM=1 npx expo run:ios --device) para tirar a
// capability de Push, que esse tipo de conta não aceita (ver plugins/withoutPushEntitlement).
// Fica fora do app.json de propósito: assim não muda o fingerprint (runtimeVersion) dos builds
// do EAS nem das atualizações, e os APKs já instalados continuam recebendo o EAS Update.
module.exports = ({ config }) =>
  process.env.FREE_APPLE_TEAM === '1'
    ? { ...config, plugins: [...(config.plugins ?? []), './plugins/withoutPushEntitlement'] }
    : config;
