// Configuração padrão do Expo + IDs de depuração do Sentry nos bundles e mapas de código
// (para os erros chegarem ao Sentry apontando a linha certa do código-fonte).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
